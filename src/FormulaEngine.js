/**
 * 公式引擎 - 统一入口
 */

const { FormulaParser } = require('./parser/FormulaParser');
const { Resolver } = require('./resolver/Resolver');
const { FormulaExecutor } = require('./executor/FormulaExecutor');

class FormulaEngine {
  constructor(documentModel) {
    this.documentModel = documentModel;
    this.parser = new FormulaParser();
    this.resolver = new Resolver(documentModel);
    this.executor = new FormulaExecutor(this.resolver);
  }

  /**
   * 执行公式（完整流程）
   */
  executeExpression(formula, options = {}) {
    const { verbose = false } = options;
    
    const result = {
      formula: formula,
      success: false,
      value: null,
      error: null,
      steps: []
    };

    try {
      // ========================================
      // 步骤 1: 解析公式
      // ========================================
      if (verbose) {
        console.log('\n========================================');
        console.log('步骤 1: 解析公式');
        console.log('========================================');
        console.log('输入:', formula);
      }

      const parseResult = this.parser.parse(formula);
      
      if (parseResult.error) {
        throw new Error(`Parse error: ${parseResult.error}`);
      }

      if (verbose) {
        console.log('输出 AST:', JSON.stringify(parseResult.ast, null, 2));
      }

      result.steps.push({
        step: 'parse',
        input: formula,
        output: parseResult.ast
      });

      // ========================================
      // 步骤 2: 执行公式
      // ========================================
      if (verbose) {
        console.log('\n========================================');
        console.log('步骤 2: 执行公式');
        console.log('========================================');
      }

      const executeResult = this.executor.execute(parseResult.ast);

      if (verbose) {
        console.log('输出结果:', JSON.stringify(executeResult, null, 2));
      }

      result.steps.push({
        step: 'execute',
        input: parseResult.ast,
        output: executeResult
      });

      // ========================================
      // 步骤 3: 返回结果
      // ========================================
      result.success = true;
      result.value = executeResult;

    } catch (error) {
      result.error = error.message;
      result.errorStack = error.stack;
    }

    return result;
  }

  /**
   * 解析公式（仅解析，不执行）
   */
  parse(formula) {
    return this.parser.parse(formula);
  }

  /**
   * 执行已解析的 AST
   */
  execute(ast) {
    return this.executor.execute(ast);
  }

  /**
   * 获取文档模型
   */
  getDocumentModel() {
    return this.documentModel;
  }
}

module.exports = { FormulaEngine };

