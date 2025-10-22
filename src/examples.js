/**
 * Mini Coda 公式引擎 - 示例
 */

const { DocumentModel } = require('./model/DataModel');
const { FormulaEngine } = require('./FormulaEngine');

// ========================================
// 创建测试数据
// ========================================

function createTestData() {
  const doc = new DocumentModel();

  // 创建员工数据库表格
  const employeeGrid = doc.createGrid('grid-employees', '员工数据库');
  
  // 添加列
  const nameColumn = doc.createColumn('col-name', 'Name', 'Text');
  const phoneColumn = doc.createColumn('col-phone', '电话', 'Text');
  const salaryColumn = doc.createColumn('col-salary', 'Salary', 'Number');
  const departmentColumn = doc.createColumn('col-dept', 'Department', 'Text');
  
  employeeGrid.addColumn(nameColumn);
  employeeGrid.addColumn(phoneColumn);
  employeeGrid.addColumn(salaryColumn);
  employeeGrid.addColumn(departmentColumn);

  // 添加一些行
  employeeGrid.addRow({
    id: 'row-1',
    values: {
      'col-name': '张三',
      'col-phone': '13800138000',
      'col-salary': 10000,
      'col-dept': '技术部'
    }
  });

  employeeGrid.addRow({
    id: 'row-2',
    values: {
      'col-name': '李四',
      'col-phone': '13900139000',
      'col-salary': 12000,
      'col-dept': '产品部'
    }
  });

  employeeGrid.addRow({
    id: 'row-3',
    values: {
      'col-name': '王五',
      'col-phone': '13700137000',
      'col-salary': 15000,
      'col-dept': '技术部'
    }
  });

  // 创建控件（用于输入）
  const nameInput = doc.createControl('ctrl-name', 'NameInput', '赵六');
  const phoneInput = doc.createControl('ctrl-phone', 'PhoneInput', '13600136000');
  const salaryInput = doc.createControl('ctrl-salary', 'SalaryInput', '11000');
  const deptInput = doc.createControl('ctrl-dept', 'DeptInput', '运营部');

  return { doc, employeeGrid, nameColumn, phoneColumn, salaryColumn, departmentColumn };
}

// ========================================
// 示例 1: 简单计算公式
// ========================================

function example1_simpleCalculation() {
  console.log('\n' + '='.repeat(60));
  console.log('示例 1: 简单计算公式');
  console.log('='.repeat(60));

  const doc = new DocumentModel();
  const engine = new FormulaEngine(doc);

  // 测试公式
  const formulas = [
    '1 + 2',
    '10 - 3',
    '5 * 6',
    '20 / 4',
    '(1 + 2) * 3',
    '10 > 5',
    '3 == 3',
    '2 != 5'
  ];

  formulas.forEach(formula => {
    console.log(`\n公式: ${formula}`);
    const result = engine.executeExpression(formula);
    if (result.success) {
      console.log(`结果: ${result.value}`);
    } else {
      console.log(`错误: ${result.error}`);
    }
  });
}

// ========================================
// 示例 2: 内置函数
// ========================================

function example2_builtInFunctions() {
  console.log('\n' + '='.repeat(60));
  console.log('示例 2: 内置函数');
  console.log('='.repeat(60));

  const doc = new DocumentModel();
  const engine = new FormulaEngine(doc);

  const formulas = [
    'Sum(1, 2, 3, 4, 5)',
    'Average(10, 20, 30)',
    'Max(5, 10, 3, 8)',
    'Min(5, 10, 3, 8)',
    'Concatenate("Hello", " ", "World")',
    'If(10 > 5, "大于", "小于")',
    'Count(1, 2, 3, 4)'
  ];

  formulas.forEach(formula => {
    console.log(`\n公式: ${formula}`);
    const result = engine.executeExpression(formula);
    if (result.success) {
      console.log(`结果: ${result.value}`);
    } else {
      console.log(`错误: ${result.error}`);
    }
  });
}

// ========================================
// 示例 3: 对象引用
// ========================================

function example3_objectReferences() {
  console.log('\n' + '='.repeat(60));
  console.log('示例 3: 对象引用');
  console.log('='.repeat(60));

  const { doc, employeeGrid } = createTestData();
  const engine = new FormulaEngine(doc);

  // 获取表格行数
  console.log('\n公式: Count($$[grid:grid-employees:::false:false:员工数据库])');
  let result = engine.executeExpression(
    'Count($$[grid:grid-employees:::false:false:员工数据库])'
  );
  console.log(`结果: 员工数据库有 ${result.value} 行`);

  // 获取控件值
  console.log('\n公式: $$[controlGrid:ctrl-name:::false:false:NameInput]');
  result = engine.executeExpression(
    '$$[controlGrid:ctrl-name:::false:false:NameInput]'
  );
  console.log(`结果: ${result.value}`);

  // 字符串拼接
  console.log('\n公式: Concatenate("姓名: ", $$[controlGrid:ctrl-name:::false:false:NameInput])');
  result = engine.executeExpression(
    'Concatenate("姓名: ", $$[controlGrid:ctrl-name:::false:false:NameInput])'
  );
  console.log(`结果: ${result.value}`);
}

// ========================================
// 示例 4: AddRow Action
// ========================================

function example4_addRowAction() {
  console.log('\n' + '='.repeat(60));
  console.log('示例 4: AddRow Action');
  console.log('='.repeat(60));

  const { doc, employeeGrid, nameColumn, phoneColumn, salaryColumn, departmentColumn } = createTestData();
  const engine = new FormulaEngine(doc);

  console.log('\n初始行数:', Object.keys(employeeGrid.rows).length);
  console.log('初始数据:');
  Object.values(employeeGrid.rows).forEach(row => {
    console.log(`  - ${row.getValue('col-name')}, ${row.getValue('col-phone')}, ${row.getValue('col-salary')}, ${row.getValue('col-dept')}`);
  });

  // 构建 AddRow 公式
  const formula = `AddRow(
    $$[grid:grid-employees:::false:false:员工数据库],
    $$[column:grid-employees:col-name::false:false:Name],
    $$[controlGrid:ctrl-name:::false:false:NameInput],
    $$[column:grid-employees:col-phone::false:false:电话],
    $$[controlGrid:ctrl-phone:::false:false:PhoneInput],
    $$[column:grid-employees:col-salary::false:false:Salary],
    $$[controlGrid:ctrl-salary:::false:false:SalaryInput],
    $$[column:grid-employees:col-dept::false:false:Department],
    $$[controlGrid:ctrl-dept:::false:false:DeptInput]
  )`;

  console.log('\n执行公式: AddRow(...)');
  const result = engine.executeExpression(formula);

  if (result.success) {
    console.log('\n✅ 添加成功!');
    console.log('新行 ID:', result.value.rowId);
    console.log('新行数据:', JSON.stringify(result.value.row, null, 2));
    
    console.log('\n更新后的行数:', Object.keys(employeeGrid.rows).length);
    console.log('更新后的数据:');
    Object.values(employeeGrid.rows).forEach(row => {
      console.log(`  - ${row.getValue('col-name')}, ${row.getValue('col-phone')}, ${row.getValue('col-salary')}, ${row.getValue('col-dept')}`);
    });
  } else {
    console.log('❌ 添加失败:', result.error);
  }
}

// ========================================
// 示例 5: ModifyRows Action
// ========================================

function example5_modifyRowsAction() {
  console.log('\n' + '='.repeat(60));
  console.log('示例 5: ModifyRows Action');
  console.log('='.repeat(60));

  const { doc, employeeGrid, departmentColumn } = createTestData();
  const engine = new FormulaEngine(doc);

  console.log('\n修改前的部门:');
  Object.values(employeeGrid.rows).forEach(row => {
    console.log(`  - ${row.getValue('col-name')}: ${row.getValue('col-dept')}`);
  });

  const formula = `ModifyRows(
    $$[grid:grid-employees:::false:false:员工数据库],
    $$[column:grid-employees:col-dept::false:false:Department],
    "新部门"
  )`;

  console.log('\n执行公式: ModifyRows(...)');
  const result = engine.executeExpression(formula);

  if (result.success) {
    console.log('\n✅ 修改成功!');
    console.log('修改行数:', result.value.modifiedCount);
    
    console.log('\n修改后的部门:');
    Object.values(employeeGrid.rows).forEach(row => {
      console.log(`  - ${row.getValue('col-name')}: ${row.getValue('col-dept')}`);
    });
  } else {
    console.log('❌ 修改失败:', result.error);
  }
}

// ========================================
// 示例 6: 详细执行过程
// ========================================

function example6_verboseExecution() {
  console.log('\n' + '='.repeat(60));
  console.log('示例 6: 详细执行过程（Verbose Mode）');
  console.log('='.repeat(60));

  const { doc } = createTestData();
  const engine = new FormulaEngine(doc);

  const formula = 'Sum(10, 20, 30)';
  
  console.log('\n执行公式:', formula);
  const result = engine.executeExpression(formula, { verbose: true });

  console.log('\n========================================');
  console.log('最终结果');
  console.log('========================================');
  console.log('成功:', result.success);
  console.log('值:', result.value);
}

// ========================================
// 主函数
// ========================================

function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         Mini Coda 公式引擎 - 完整示例                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    example1_simpleCalculation();
    example2_builtInFunctions();
    example3_objectReferences();
    example4_addRowAction();
    example5_modifyRowsAction();
    example6_verboseExecution();

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有示例执行完成！');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  createTestData,
  example1_simpleCalculation,
  example2_builtInFunctions,
  example3_objectReferences,
  example4_addRowAction,
  example5_modifyRowsAction,
  example6_verboseExecution
};

