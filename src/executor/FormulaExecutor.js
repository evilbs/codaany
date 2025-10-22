/**
 * 公式执行器 - 执行公式和 Action
 */

const { ASTVisitor } = require('../visitor/ASTVisitor');

class FormulaExecutor {
  constructor(resolver) {
    this.resolver = resolver;
    this.visitor = new ASTVisitor(resolver);
    this.functions = this._registerFunctions();
  }

  /**
   * 执行公式
   */
  execute(ast) {
    // 先访问 AST，求值所有参数
    const result = this.visitor.visit(ast);

    // 如果结果是函数调用，执行函数
    if (result && result.type === 'FunctionCall') {
      return this._executeFunction(result);
    }

    return result;
  }

  /**
   * 执行函数
   */
  _executeFunction(node) {
    const { name, arguments: args } = node;

    // 查找函数定义
    const func = this.functions[name];
    if (!func) {
      throw new Error(`Unknown function: ${name}`);
    }

    // 执行函数
    return func.execute(args, this.resolver);
  }

  /**
   * 注册内置函数
   */
  _registerFunctions() {
    return {
      // ========================================
      // Action 函数
      // ========================================
      
      AddRow: {
        name: 'AddRow',
        isAction: true,
        execute: (args, resolver) => {
          // args = [Grid, Column, value, Column, value, ...]
          
          if (args.length < 1) {
            throw new Error('AddRow requires at least 1 argument (grid)');
          }

          const grid = args[0];
          if (!grid || grid.type !== 'Grid') {
            throw new Error('First argument must be a Grid');
          }

          // 解析 column-value 对
          const columnValuePairs = [];
          for (let i = 1; i < args.length; i += 2) {
            if (i + 1 < args.length) {
              columnValuePairs.push({
                column: args[i],
                value: args[i + 1]
              });
            }
          }

          // 生成新行 ID
          const newRowId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // 构建行数据
          const rowData = {
            id: newRowId,
            values: {}
          };

          // 填充列值
          columnValuePairs.forEach(pair => {
            if (pair.column && pair.column.id) {
              rowData.values[pair.column.id] = pair.value;
            }
          });

          // 添加行到 Grid
          const row = grid.addRow(rowData);

          // 返回结果
          return {
            type: 'ActionResult',
            success: true,
            action: 'AddRow',
            rowId: newRowId,
            row: row,
            grid: grid
          };
        }
      },

      ModifyRows: {
        name: 'ModifyRows',
        isAction: true,
        execute: (args, resolver) => {
          // args = [Grid, Column, newValue]
          
          if (args.length < 3) {
            throw new Error('ModifyRows requires at least 3 arguments');
          }

          const grid = args[0];
          const column = args[1];
          const newValue = args[2];

          if (!grid || grid.type !== 'Grid') {
            throw new Error('First argument must be a Grid');
          }

          if (!column || column.type !== 'Column') {
            throw new Error('Second argument must be a Column');
          }

          // 修改所有行的指定列
          const modifiedRows = [];
          Object.values(grid.rows).forEach(row => {
            row.setValue(column.id, newValue);
            modifiedRows.push(row);
          });

          return {
            type: 'ActionResult',
            success: true,
            action: 'ModifyRows',
            modifiedCount: modifiedRows.length,
            rows: modifiedRows
          };
        }
      },

      // ========================================
      // 计算函数
      // ========================================

      Sum: {
        name: 'Sum',
        isAction: false,
        execute: (args) => {
          return args.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        }
      },

      Count: {
        name: 'Count',
        isAction: false,
        execute: (args) => {
          // 如果参数是 Grid，返回行数
          if (args.length === 1 && args[0] && args[0].type === 'Grid') {
            return Object.keys(args[0].rows).length;
          }
          // 否则返回参数个数
          return args.length;
        }
      },

      Average: {
        name: 'Average',
        isAction: false,
        execute: (args) => {
          if (args.length === 0) return 0;
          const sum = args.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
          return sum / args.length;
        }
      },

      Max: {
        name: 'Max',
        isAction: false,
        execute: (args) => {
          if (args.length === 0) return null;
          return Math.max(...args.map(val => parseFloat(val) || -Infinity));
        }
      },

      Min: {
        name: 'Min',
        isAction: false,
        execute: (args) => {
          if (args.length === 0) return null;
          return Math.min(...args.map(val => parseFloat(val) || Infinity));
        }
      },

      Concatenate: {
        name: 'Concatenate',
        isAction: false,
        execute: (args) => {
          return args.map(val => String(val)).join('');
        }
      },

      If: {
        name: 'If',
        isAction: false,
        execute: (args) => {
          if (args.length < 2) {
            throw new Error('If requires at least 2 arguments');
          }
          
          const condition = args[0];
          const trueValue = args[1];
          const falseValue = args[2] !== undefined ? args[2] : null;
          
          return condition ? trueValue : falseValue;
        }
      }
    };
  }

  /**
   * 获取函数定义
   */
  getFunction(name) {
    return this.functions[name];
  }

  /**
   * 检查是否是 Action 函数
   */
  isActionFunction(name) {
    const func = this.functions[name];
    return func && func.isAction;
  }
}

module.exports = { FormulaExecutor };

