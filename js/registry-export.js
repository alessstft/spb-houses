import { EXCELJS_URL, REGISTRY_COLUMNS, REGISTRY_FRAME, REGISTRY_SHEETS, REGISTRY_STATS } from './config.js';
import { getPremises, sortPremises } from './premises.js';
import { registryAddress, shortAddress } from './address.js';
import { loadScript, toNumber } from './utils.js';

const THIN = { style: 'thin' };
const MEDIUM = { style: 'medium' };

// «…, литер А, кв. 3», «…, литер А, пом. 1-Н», «…, литер А, кв. 17, ком. 2,5»
function premiseAddress(houseAddress, premise) {
  const isLiving = premise.status === 'КВ' || premise.status === 'ЧКВ';
  let address = `${houseAddress}, ${isLiving ? 'кв.' : 'пом.'} ${premise.number}`;
  if (premise.room) address += `, ком. ${premise.room}`;
  return address;
}

function toRegistryRow(premise, { house, table, houseCadastral }) {
  const houseAddress = registryAddress(house.address);
  const isHouse = premise.status === 'МКД';

  const fields = {
    status: premise.status,
    address: isHouse ? `г. ${houseAddress}` : premiseAddress(houseAddress, premise),
    number: isHouse ? null : /^\d+$/.test(premise.number) ? Number(premise.number) : premise.number,
    // площадь помещения появится, когда будет в данных (в ГИС ЖКХ её нет)
    area: toNumber(isHouse ? table.get(house, 'area') : premise.area),
    cadastral: premise.cadastral,
    type: isHouse ? 'Здание' : 'Помещение',
    fiasId: premise.fiasId,
    houseCadastral,
  };
  return REGISTRY_COLUMNS.map((column) => (column.key && fields[column.key]) || null);
}

function cellBorder(col, isHeader) {
  const { from, to } = REGISTRY_FRAME;
  if (col >= from && col <= to) {
    return { left: THIN, top: isHeader ? MEDIUM : THIN, bottom: THIN, right: col === to ? MEDIUM : THIN };
  }
  if (col > to) return { left: THIN, top: THIN, bottom: THIN, right: THIN };
  return { right: THIN, bottom: THIN };
}

function styleSheet(sheet) {
  REGISTRY_COLUMNS.forEach((column, i) => {
    sheet.getColumn(i + 1).width = column.width;
    if (column.hidden) sheet.getColumn(i + 1).hidden = true;
  });

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const isHeader = rowNumber === 1;
    for (let col = 1; col <= REGISTRY_COLUMNS.length; col++) {
      const cell = row.getCell(col);
      cell.font = { name: 'Arial Narrow', size: 8 };
      cell.alignment = { vertical: 'top', horizontal: col === 3 ? 'center' : 'left', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isHeader ? 'FFFFFF00' : 'FFFFFFFF' },
      };
      cell.border = cellBorder(col, isHeader);
    }
  });

  sheet.getRow(1).height = 51;
  sheet.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];
}

const columnLetter = (key) => String.fromCharCode(65 + REGISTRY_COLUMNS.findIndex((c) => c.key === key));

/**
 * Добавляет справа от реестра таблицу «Статус / Кол-во / Площадь / % площади»
 * и формулу доли в столбец «Доля ОИ, %». Всё считается формулами Excel:
 * площадей в ГИС ЖКХ нет, их вносят вручную, и итоги пересчитываются сами.
 */
function addStats(sheet, lastRow) {
  const status = columnLetter('status');
  const area = columnLetter('area');
  const share = columnLetter('share');
  const statusRange = `$${status}$2:$${status}$${lastRow}`;
  const areaRange = `$${area}$2:$${area}$${lastRow}`;

  const col = REGISTRY_STATS.firstColumn;
  const letter = (offset) => String.fromCharCode(64 + col + offset);
  const [countCol, areaCol, percentCol] = [letter(1), letter(2), letter(3)];
  const totalArea = `$${areaCol}$2`; // строка «КВ+НЖ+ММ»

  const { main, other } = REGISTRY_STATS;
  const put = (rowNumber, values) =>
    values.forEach((value, i) => {
      sheet.getCell(rowNumber, col + i).value = value;
    });

  put(1, ['Статус', 'Кол-во', 'Площадь, м²', '% площади']);
  put(2, [
    main.join('+'),
    { formula: main.map((s) => `COUNTIF(${statusRange},"${s}")`).join('+') },
    { formula: main.map((s) => `SUMIF(${statusRange},"${s}",${areaRange})`).join('+') },
    1,
  ]);
  main.forEach((s, i) => {
    const row = 3 + i;
    put(row, [
      s,
      { formula: `COUNTIF(${statusRange},"${s}")` },
      { formula: `SUMIF(${statusRange},"${s}",${areaRange})` },
      { formula: `IF(${totalArea}=0,0,${areaCol}${row}/${totalArea})` },
    ]);
  });
  other.forEach((s, i) => {
    const row = 3 + main.length + i;
    put(row, [
      s,
      { formula: `COUNTIF(${statusRange},"${s}")` },
      { formula: `SUMIF(${statusRange},"${s}",${areaRange})` },
      null,
    ]);
  });
  const lastStatsRow = 2 + main.length + other.length;

  // Оформление блока
  for (let row = 1; row <= lastStatsRow; row++) {
    for (let i = 0; i < 4; i++) {
      const cell = sheet.getCell(row, col + i);
      cell.font = { name: 'Arial Narrow', size: 8, bold: row <= 2 };
      cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
      if (row === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    }
    sheet.getCell(row, col + 2).numFmt = '#,##0.0';
    sheet.getCell(row, col + 3).numFmt = '0.0%';
  }
  sheet.getColumn(col).width = 9;
  sheet.getColumn(col + 1).width = 7;
  sheet.getColumn(col + 2).width = 10;
  sheet.getColumn(col + 3).width = 8;

  // Доля ОИ, % = площадь помещения / площадь всех КВ+НЖ+ММ × 100
  for (let row = 2; row <= lastRow; row++) {
    const rowStatus = sheet.getCell(`${status}${row}`).value;
    if (!main.includes(rowStatus)) continue;
    const cell = sheet.getCell(`${share}${row}`);
    cell.value = {
      formula: `IF(OR(${area}${row}="",${totalArea}=0),"",ROUND(${area}${row}/${totalArea}*100,3))`,
    };
    cell.numFmt = '0.000';
  }
}

function download(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.append(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 2000);
}

function fileNameFor(house) {
  const name = shortAddress(house.address)
    .replace(/\//g, '-')
    .replace(/[\\:*?"<>|]/g, '')
    .replace(/[\s,.]+/g, '_')
    .replace(/_+$/, '');
  return `Реестр_${name}.xlsx`;
}

/** Выгружает реестр помещений дома. Возвращает число помещений (без строки МКД). */
export async function exportRegistry(house, table) {
  const guid = table.get(house, 'guid');
  if (!guid) throw new Error('в загруженном файле нет столбца «GUID дома»');

  const [premises] = await Promise.all([getPremises(guid), loadScript(EXCELJS_URL, 'ExcelJS')]);
  if (!premises.length) throw new Error('по этому дому в данных нет помещений');

  // кадастровый номер дома берём из строки МКД и повторяем у каждого помещения
  const houseCadastral = premises.find((p) => p.status === 'МКД')?.cadastral || '';

  const workbook = new ExcelJS.Workbook();
  REGISTRY_SHEETS.forEach((name) => workbook.addWorksheet(name));
  workbook.views = [{ activeTab: REGISTRY_SHEETS.indexOf('Помещения') }];

  const sheet = workbook.getWorksheet('Помещения');
  sheet.addRow(REGISTRY_COLUMNS.map((column) => column.title));
  for (const premise of sortPremises(premises)) {
    sheet.addRow(toRegistryRow(premise, { house, table, houseCadastral }));
  }
  styleSheet(sheet);
  addStats(sheet, sheet.rowCount);
  workbook.calcProperties.fullCalcOnLoad = true; // Excel пересчитает формулы при открытии

  download(await workbook.xlsx.writeBuffer(), fileNameFor(house));
  return premises.filter((p) => p.status !== 'МКД').length;
}