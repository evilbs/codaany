/**
 * 引用解析器 - 解析对象引用
 */

class Resolver {
  constructor(documentModel) {
    this.documentModel = documentModel;
  }

  /**
   * 解析对象引用
   */
  resolveReference(node) {
    if (node.type !== 'ObjectReference') {
      return null;
    }

    const { refType, objectId, fieldId } = node;

    switch (refType) {
      case 'grid':
      case 'table':
        return this._resolveGrid(objectId);

      case 'column':
        return this._resolveColumn(objectId, fieldId);

      case 'row':
        return this._resolveRow(objectId, fieldId);

      case 'controlGrid':
        return this._resolveControlValue(objectId);

      default:
        throw new Error(`Unknown reference type: ${refType}`);
    }
  }

  /**
   * 解析 Grid 引用
   */
  _resolveGrid(gridId) {
    const grid = this.documentModel.getObject(gridId);
    
    if (!grid || grid.type !== 'Grid') {
      throw new Error(`Grid not found: ${gridId}`);
    }

    return grid;
  }

  /**
   * 解析 Column 引用
   */
  _resolveColumn(gridId, columnId) {
    const grid = this._resolveGrid(gridId);
    const column = grid.getColumn(columnId);
    
    if (!column) {
      throw new Error(`Column not found: ${columnId} in grid ${gridId}`);
    }

    return column;
  }

  /**
   * 解析 Row 引用
   */
  _resolveRow(gridId, rowId) {
    const grid = this._resolveGrid(gridId);
    const row = grid.getRow(rowId);
    
    if (!row) {
      throw new Error(`Row not found: ${rowId} in grid ${gridId}`);
    }

    return row;
  }

  /**
   * 解析 ControlGrid 引用
   * 🔑 特殊处理：返回 value 而不是对象本身
   */
  _resolveControlValue(controlId) {
    const control = this.documentModel.getObject(controlId);
    
    if (!control || control.type !== 'ControlGrid') {
      throw new Error(`ControlGrid not found: ${controlId}`);
    }

    // 🔑 返回 control 的 value，而不是 control 对象本身
    return control.value;
  }

  /**
   * 获取对象（通用方法）
   */
  getObject(objectId) {
    return this.documentModel.getObject(objectId);
  }
}

module.exports = { Resolver };

