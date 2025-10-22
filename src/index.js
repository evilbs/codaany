/**
 * Mini Coda 公式引擎 - 入口文件
 */

const { DocumentModel } = require('./model/DataModel');
const { FormulaEngine } = require('./FormulaEngine');

// 导出所有模块
module.exports = {
  DocumentModel,
  FormulaEngine
};

// 如果直接运行此文件，执行示例
if (require.main === module) {
  console.log('Mini Coda 公式引擎');
  console.log('请运行 examples.js 查看示例');
  console.log('命令: node src/examples.js');
}

