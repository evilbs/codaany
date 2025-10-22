/**
 * 数据模型 - 模拟 Coda 的数据结构
 */

class Grid {
  constructor(id, name) {
    this.type = 'Grid';
    this.id = id;
    this.name = name;
    this.columns = new Map();
    this.rows = {};
    this._nextRowNumber = 1;
  }

  addColumn(column) {
    this.columns.set(column.id, column);
    column.gridId = this.id;
  }

  addRow(rowData) {
    const row = new Row(rowData.id || this._generateRowId(), this.id);
    row.rowNumber = this._nextRowNumber++;
    
    // 设置列值
    if (rowData.values) {
      Object.keys(rowData.values).forEach(columnId => {
        row.setValue(columnId, rowData.values[columnId]);
      });
    }
    
    this.rows[row.id] = row;
    return row;
  }

  getColumn(columnId) {
    return this.columns.get(columnId);
  }

  getRow(rowId) {
    return this.rows[rowId];
  }

  getAllRows() {
    return Object.values(this.rows);
  }

  _generateRowId() {
    return `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      columns: Array.from(this.columns.values()),
      rows: Object.values(this.rows)
    };
  }
}

class Column {
  constructor(id, name, format = 'Text') {
    this.type = 'Column';
    this.id = id;
    this.name = name;
    this.format = { type: format };
    this.gridId = null;
  }

  toJSON() {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      format: this.format
    };
  }
}

class Row {
  constructor(id, gridId) {
    this.type = 'Row';
    this.id = id;
    this.gridId = gridId;
    this.rowNumber = 0;
    this.values = {};
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();
  }

  setValue(columnId, value) {
    this.values[columnId] = {
      value: value,
      timestamp: Date.now()
    };
    this.modifiedAt = Date.now();
  }

  getValue(columnId) {
    return this.values[columnId]?.value;
  }

  toJSON() {
    return {
      type: this.type,
      id: this.id,
      gridId: this.gridId,
      rowNumber: this.rowNumber,
      values: this.values,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt
    };
  }
}

class ControlGrid {
  constructor(id, name, initialValue = '') {
    this.type = 'ControlGrid';
    this.id = id;
    this.name = name;
    this.value = initialValue;
  }

  setValue(value) {
    this.value = value;
  }

  toJSON() {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      value: this.value
    };
  }
}

class DocumentModel {
  constructor() {
    this._objectsMap = {};
    this.grids = new Map();
    this.controls = new Map();
  }

  registerObject(obj) {
    this._objectsMap[obj.id] = obj;
    
    if (obj.type === 'Grid') {
      this.grids.set(obj.id, obj);
    } else if (obj.type === 'ControlGrid') {
      this.controls.set(obj.id, obj);
    }
  }

  getObject(objectId) {
    return this._objectsMap[objectId];
  }

  createGrid(id, name) {
    const grid = new Grid(id, name);
    this.registerObject(grid);
    return grid;
  }

  createColumn(id, name, format) {
    return new Column(id, name, format);
  }

  createControl(id, name, initialValue) {
    const control = new ControlGrid(id, name, initialValue);
    this.registerObject(control);
    return control;
  }

  toJSON() {
    return {
      grids: Array.from(this.grids.values()),
      controls: Array.from(this.controls.values())
    };
  }
}

module.exports = {
  DocumentModel,
  Grid,
  Column,
  Row,
  ControlGrid
};

