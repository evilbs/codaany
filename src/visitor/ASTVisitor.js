/**
 * AST 访问器 - 遍历和求值 AST
 */

class ASTVisitor {
  constructor(resolver) {
    this.resolver = resolver;
    this.context = {};
  }

  /**
   * 从根节点开始访问
   */
  visitRoot(ast) {
    return this.visit(ast);
  }

  /**
   * 访问节点（根据类型分发）
   */
  visit(node) {
    if (!node) {
      return null;
    }

    switch (node.type) {
      case 'FunctionCall':
        return this.visitFunctionCall(node);

      case 'ObjectReference':
        return this.visitObjectReference(node);

      case 'Literal':
        return this.visitLiteral(node);

      case 'BinaryExpression':
        return this.visitBinaryExpression(node);

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * 访问函数调用节点
   */
  visitFunctionCall(node) {
    // 返回未求值的函数调用节点，供 Executor 处理
    // 因为函数调用需要知道函数定义才能执行
    return {
      type: 'FunctionCall',
      name: node.name,
      arguments: node.arguments.map(arg => this.visit(arg))
    };
  }

  /**
   * 访问对象引用节点
   */
  visitObjectReference(node) {
    // 使用 Resolver 解析引用
    return this.resolver.resolveReference(node);
  }

  /**
   * 访问字面量节点
   */
  visitLiteral(node) {
    return node.value;
  }

  /**
   * 访问二元表达式节点
   */
  visitBinaryExpression(node) {
    const left = this.visit(node.left);
    const right = this.visit(node.right);

    switch (node.operator) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        if (right === 0) {
          throw new Error('Division by zero');
        }
        return left / right;
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }
}

module.exports = { ASTVisitor };

