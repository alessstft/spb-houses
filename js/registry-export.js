import { EXCELJS_URL, REGISTRY_COLUMNS, REGISTRY_SHEETS, STATUS_GROUP } from './config.js';
import { getPremises } from './premises.js';
import { registryAddress, shortAddress } from './address.js';
import { loadScript, naturalCompare, toNumber } from './utils.js';

const THIN = { style: 'thin' };
const MEDIUM = { style: 'medium' };

function sortPremises(list) {
  return list.sort(
    (a, b) =>
      (STATUS_GROUP[a.status] ?? 3) - (STATUS_GROUP[b.status] ?? 3) ||
      naturalCompare(a.number, b.number) ||
      // комнаты идут сразу под своей квартирой
      (a.status === 'ЧКВ') - (b.status === 'ЧКВ') ||
      naturalCompare(a.room, b.room),
  );
}

function toRegistryRow(premise, house, table) {
  const baseAddress = registryAddress(house.address);

  if (premise.status === 'МКД') {
    const area = toNumber(table.get(house, 'area'));
    return [
      'МКД',
      `г. ${baseAddress}`,
      null,
      area,
      premise.cadastral || null,
      null,
      null,
      null,
      null,
      null,
      'Здание',
      null,
    ];
  }

  const isLiving = premise.status === 'КВ' || premise.status === 'ЧКВ';
  let address = `${baseAddress}, ${isLiving ? 'кв.' : 'пом.'} ${premise.number}`;
  if (premise.room) address += `, ком. ${premise.room}`;
  const number = /^\d+$/.test(premise.number) ? Number(premise.number) : premise.number;

  return [
    premise.status,
    address,
    number,
    null,
    premise.cadastral || null,
    null,
    null,
    null,
    null,
    null,
    'Помещение',
    null,
  ];
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
      // последние три столбца в шаблоне выделены рамкой
      cell.border =
        col >= 10
          ? { left: THIN, top: isHeader ? MEDIUM : THIN, bottom: THIN, right: col === 12 ? MEDIUM : THIN }
          : { right: THIN, bottom: THIN };
    }
  });

  sheet.getRow(1).height = 51;
  sheet.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];
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

  const workbook = new ExcelJS.Workbook();
  REGISTRY_SHEETS.forEach((name) => workbook.addWorksheet(name));
  workbook.views = [{ activeTab: REGISTRY_SHEETS.indexOf('Помещения') }];

  const sheet = workbook.getWorksheet('Помещения');
  sheet.addRow(REGISTRY_COLUMNS.map((column) => column.title));
  for (const premise of sortPremises(premises)) {
    sheet.addRow(toRegistryRow(premise, house, table));
  }
  styleSheet(sheet);

  download(await workbook.xlsx.writeBuffer(), fileNameFor(house));
  return premises.filter((p) => p.status !== 'МКД').length;
}
