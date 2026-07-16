const fs = require('node:fs');

// シンプルなCSVパーサ（クォート無し・カンマ区切りのみを想定）
function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const text = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((header, i) => {
      const value = cells[i] !== undefined ? cells[i].trim() : '';
      row[header.trim()] = value === '' ? null : value;
    });
    return row;
  });
}

module.exports = { readCsv };
