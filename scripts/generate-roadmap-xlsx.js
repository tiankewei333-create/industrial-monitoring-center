/**
 * Generate 24-month Industrial Digital Twin Engineer roadmap Excel.
 * Run: node scripts/generate-roadmap-xlsx.js
 */
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "..", "docs", "career-roadmap");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(
  outDir,
  "Industrial-Digital-Twin-Engineer-24个月执行路线表.xlsx",
);

const workbook = new ExcelJS.Workbook();
workbook.creator = "IMC";
workbook.created = new Date();

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A5F" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 22;
}

function autosize(sheet, widths) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

function addRows(sheet, rows) {
  for (const r of rows) sheet.addRow(r);
}

// ---------- Sheet1: 24个月总路线 ----------
{
  const s = workbook.addWorksheet("01-24个月总路线", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  s.addRow(["月份", "阶段", "核心目标", "重点技术", "项目里程碑", "职业节点", "所属项目"]);
  styleHeader(s.getRow(1));
  addRows(s, [
    ["M1", "基础强化", "进入 Three.js 生态", "React、TS、Three.js、R3F", "完成基础 3D Viewer", "建立 GitHub", "P1 CNC"],
    ["M2", "3D资产", "掌握工业模型流程", "Blender、GLB、PBR", "完成第一个工业模型", "发布模型 Demo", "P1 CNC"],
    ["M3", "CNC项目启动", "工业产品展示", "R3F、Loader、Camera、Controls", "CNC Viewer 完成", "准备 Portfolio", "P1 CNC"],
    ["M4", "CNC增强", "商业配置能力", "GSAP、状态管理、模型切换", "爆炸动画、配置功能", "准备美国接单", "P1 CNC"],
    ["M5", "WebGL优化", "提升 3D 工程能力", "LOD、Draco、KTX2、性能分析", "GLB 优化流程", "展示高级能力", "P1 CNC"],
    ["M6", "项目发布", "完成 Project1", "部署、视频、英文文档", "CNC Configurator 上线", "尝试接单", "P1 CNC"],
    ["M7", "工业基础", "进入工业互联网", "MQTT、IoT、Node.js", "设备模拟器", "学习工业语言", "P2 Monitoring"],
    ["M8", "设备监控", "3D 工厂场景", "Three.js 大型场景管理", "Machine Monitoring 场景完成", "发布第二项目", "P2 Monitoring"],
    ["M9", "实时数据", "设备数据链路", "WebSocket、Socket.io", "实时状态同步", "开始投远程", "P2 Monitoring"],
    ["M10", "工业 Dashboard", "数据可视化", "ECharts、数据模型", "KPI、Alarm 系统", "积累案例", "P2 Monitoring"],
    ["M11", "高级渲染", "增强竞争力", "GLSL Shader", "温度热力图", "提升技术壁垒", "P2 Monitoring"],
    ["M12", "项目发布", "完成 Project2", "Docker 部署", "Industrial Monitoring", "美国订单尝试", "P2 Monitoring"],
    ["M13", "数字孪生基础", "理解 Twin 架构", "Asset、Twin Model、Data Binding", "设计 Twin Engine", "准备德国方向", "P3 Smart Factory"],
    ["M14", "Smart Factory", "工厂数字化", "Factory Scene、Production Line", "智能工厂场景", "", "P3 Smart Factory"],
    ["M15", "Twin Engine", "核心能力", "Object Mapping、状态同步", "设备数据绑定", "", "P3 Smart Factory"],
    ["M16", "工业协议", "接近真实工业", "OPC-UA、PLC 概念", "工业数据模拟", "", "P3 Smart Factory"],
    ["M17", "大型场景优化", "高级 Three.js", "BVH、Instancing、LOD", "性能优化", "", "P3 Smart Factory"],
    ["M18", "项目发布", "完成 Project3", "Portfolio 包装", "Smart Factory Twin", "", "P3 Smart Factory"],
    ["M19", "机器人方向", "机器人可视化", "机器人模型、Joint 控制", "Robot Twin", "", "P4 Robot"],
    ["M20", "机器人增强", "轨迹模拟", "Kinematics、Trajectory", "机器人运动", "", "P4 Robot"],
    ["M21", "作品集升级", "个人品牌", "网站、视频、英文介绍", "完整 Portfolio", "", "品牌"],
    ["M22", "德国求职", "准备面试", "系统设计、项目复盘", "大量投递", "", "求职"],
    ["M23", "面试阶段", "技术交流", "英文面试、德语交流", "德国面试", "", "求职"],
    ["M24", "职业转换", "进入岗位", "工作准备", "Digital Twin Engineer", "", "求职"],
  ]);
  autosize(s, [8, 14, 18, 36, 28, 18, 16]);
}

// ---------- Sheet2: 每日模板 ----------
{
  const s = workbook.addWorksheet("02-每日6小时模板");
  s.addRow(["阶段", "每日时长", "内容", "备注"]);
  styleHeader(s.getRow(1));
  addRows(s, [
    ["前12个月", "2h", "React + TypeScript + Three.js", "核心工程能力"],
    ["前12个月", "1.5h", "Blender / WebGL / GLSL", "资产与渲染"],
    ["前12个月", "1h", "项目开发", "落到 Portfolio"],
    ["前12个月", "1h", "英语", "项目介绍 → 技术讨论"],
    ["前12个月", "0.5h", "德语", "A1-A2 → B1"],
    ["前12个月", "合计 6h", "", ""],
    ["后12个月", "3h", "Digital Twin 项目", "P3/P4 主战场"],
    ["后12个月", "1h", "工业技术", "OPC-UA / MES / SCADA 概念"],
    ["后12个月", "1h", "英语", "面试与架构表达"],
    ["后12个月", "1h", "德语", "B1 → B2 工业词汇"],
    ["后12个月", "合计 6h", "", ""],
  ]);
  autosize(s, [12, 12, 36, 24]);

  s.addRow([]);
  s.addRow(["每周任务模板", "", "", ""]);
  styleHeader(s.getRow(s.lastRow.number));
  s.addRow(["星期", "技术学习", "项目交付", "语言", "产出物"]);
  styleHeader(s.getRow(s.lastRow.number));
  addRows(s, [
    ["周一", "框架/协议", "功能开发", "英语口语", "代码 commit"],
    ["周二", "3D/Shader", "功能开发", "英语写作", "代码 commit"],
    ["周三", "工业知识", "联调/修复", "德语词汇", "短视频/截图"],
    ["周四", "性能/工程化", "功能开发", "英语项目介绍", "文档更新"],
    ["周五", "复盘薄弱点", "本周收尾", "德语听力", "周报 5 条"],
    ["周末机动", "补课或休息", "可选加速", "口语模拟", "Demo 录制"],
  ]);
}

// ---------- Sheet3: 四大项目 ----------
{
  const s = workbook.addWorksheet("03-四大Portfolio项目");
  s.addRow([
    "项目",
    "周期",
    "目标",
    "技术栈",
    "核心功能",
    "最终展示名",
    "商业/职业价值",
    "与当前IMC关系",
    "可行性评级",
  ]);
  styleHeader(s.getRow(1));
  addRows(s, [
    [
      "P1 CNC Machine Configurator",
      "M1-M6",
      "工业设备 Web 3D 展示与配置",
      "React, TS, R3F, Three.js, Blender, GLTF, GSAP, Zustand",
      "三维展示;部件切换;爆炸动画;参数配置;材质切换;产品报价",
      "Interactive Industrial CNC Configurator",
      "美国远程接单入口",
      "独立新项目（营销向）",
      "可行（中高）",
    ],
    [
      "P2 Industrial Machine Monitoring",
      "M7-M12",
      "工业设备实时监控",
      "Three.js, WS, MQTT, Node, PG, Shader, ECharts, Docker",
      "工厂3D;CNC状态;温度监控;报警;历史趋势",
      "Real-time Industrial Machine Monitoring Platform",
      "工业闭环作品集核心之一",
      "≈ 当前 industrial-monitoring-center（已开工）",
      "可行（高）— 应主线做",
    ],
    [
      "P3 Smart Factory Digital Twin",
      "M13-M18",
      "德国方向核心：工厂级数字孪生",
      "Three.js, Twin架构, MQTT, OPC-UA, InfluxDB, GLSL",
      "工厂孪生;产线;能源;设备关系;数据驱动3D",
      "Smart Factory Digital Twin Platform",
      "德国求职主打项目",
      "P2 的架构升级版，勿平行重开",
      "可行（中）— 需收敛范围",
    ],
    [
      "P4 Robot Digital Twin",
      "M19-M20",
      "补足自动化/机器人可视化",
      "Three.js, Animation, Kinematics, ROS2基础, WS",
      "六轴机器人;关节运动;工作范围;轨迹;状态监控",
      "Industrial Robot Digital Twin",
      "差异化加分项",
      "可挂在 IMC/Workshop 内作模块",
      "可行（中）— 2个月紧，做 MVP",
    ],
  ]);
  autosize(s, [28, 10, 28, 40, 40, 36, 20, 32, 18]);
}

// ---------- Sheet4: 技术学习地图 ----------
{
  const s = workbook.addWorksheet("04-技术学习地图");
  s.addRow(["优先级", "主题", "目标", "必须掌握", "推荐资料", "对应月份"]);
  styleHeader(s.getRow(1));
  addRows(s, [
    ["P0", "React + TypeScript", "高级前端能力", "Hooks、状态管理、性能、工程化", "React 官方; TS Handbook", "M1-M6 持续"],
    ["P0", "Three.js / R3F", "核心竞争力", "Scene/Camera/Renderer/Material/Shader/Animation/Loading/Perf", "Three.js Journey; Discover Three.js", "M1-M18"],
    ["P0", "Blender", "工业资产能力", "建模、UV、PBR、GLB、Animation、Optimization", "Blender 官方教程", "M2-M6"],
    ["P1", "WebGL / GLSL", "技术壁垒", "Vertex/Fragment、Lighting、Texture、GPU Pipeline", "The Book of Shaders 等", "M5,M11,M17"],
    ["P1", "MQTT / IoT", "工业通信", "Topic、Broker、QoS、模拟器", "Mosquitto 实战", "M7-M9"],
    ["P1", "WebSocket", "实时链路", "推送、重连、协议设计", "自建 realtime 服务", "M9"],
    ["P2", "OPC-UA", "德国工业协议认知", "概念、模拟器、与 MQTT 边界", "open62541 / node-opcua 入门", "M16"],
    ["P2", "MES / SCADA 概念", "业务语境", "层级、数据流、不自己造完整 MES", "公开白皮书/课程", "M13-M16"],
    ["P2", "Docker / 部署", "可交付", "Compose、健康检查、文档", "官方文档", "M6,M12"],
    ["P2", "ECharts / Dashboard", "可视化", "KPI、Alarm、趋势图", "ECharts 示例", "M10"],
  ]);
  autosize(s, [8, 18, 18, 48, 32, 14]);
}

// ---------- Sheet5: 语言 ----------
{
  const s = workbook.addWorksheet("05-语言学习规划");
  s.addRow(["语言", "阶段", "目标", "每日", "练习重点", "示例/关键词"]);
  styleHeader(s.getRow(1));
  addRows(s, [
    ["英语", "0-6月", "能介绍项目", "60min", "项目口述", "This project is an industrial CNC configurator. It uses React and Three.js."],
    ["英语", "6-12月", "技术讨论", "60min", "取舍问答", "Why WebSocket instead of polling?"],
    ["英语", "12-24月", "面试流畅", "60min", "架构/复盘", "Architecture explanation & tradeoffs"],
    ["德语", "0-6月", "A1-A2", "30min", "基础听说", "DW Deutsch Lernen; Menschen A1/A2"],
    ["德语", "7-12月", "B1", "30-45min", "工作交流", "邮件、会议常用语"],
    ["德语", "13-24月", "B2 工业向", "60min", "工业词汇", "Automatisierung; Fertigung; Maschine; Sensor; Wartung; Produktion; Digitalisierung"],
  ]);
  autosize(s, [8, 10, 14, 10, 16, 70]);
}

// ---------- Sheet6: 职业节点 ----------
{
  const s = workbook.addWorksheet("06-德国求职与美国远程");
  s.addRow(["时间节点", "动作", "关键词/渠道", "目标产出", "备注"]);
  styleHeader(s.getRow(1));
  addRows(s, [
    ["Month 6", "CNC 上线 + GitHub/个人站", "Portfolio 初版", "可分享 Demo 链接", "先证明会做 3D 产品"],
    ["Month 9", "美国远程平台开始投", "Three.js / WebGL / R3F / 3D Configurator / Industrial Visualization", "简历+作品链接", "Upwork/相关平台"],
    ["Month 12", "第一批商业项目尝试", "报价 $1500-$5000", "1 个付费小单或强线索", "监控平台也可作交付物"],
    ["Month 18", "德国岗位准备", "Digital Twin Engineer; Industrial Software Engineer; 3D Visualization; WebGL Engineer", "德英双语简历", "P3 为主打案例"],
    ["Month 21-24", "正式求职/面试", "系统设计 + 项目复盘 + 德语交流", "拿到面试与 Offer", "岗位名以 Digital Twin / Industrial SW 为主"],
    ["最终定位", "从 Qt/QML 设备 UI → Industrial Digital Twin Engineer", "", "4 项目 + 双语能力", "能力对齐、规模诚实"],
  ]);
  autosize(s, [14, 28, 55, 22, 22]);
}

// ---------- Sheet7: 甘特简表 ----------
{
  const s = workbook.addWorksheet("07-项目甘特简表");
  s.addRow(["项目", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M13", "M14", "M15", "M16", "M17", "M18", "M19", "M20", "M21", "M22", "M23", "M24"]);
  styleHeader(s.getRow(1));
  const mark = (from, to) => {
    const row = ["", ...Array(24).fill("")];
    for (let m = from; m <= to; m++) row[m] = "■";
    return row;
  };
  const r1 = mark(1, 6); r1[0] = "P1 CNC Configurator";
  const r2 = mark(7, 12); r2[0] = "P2 Machine Monitoring";
  const r3 = mark(13, 18); r3[0] = "P3 Smart Factory Twin";
  const r4 = mark(19, 20); r4[0] = "P4 Robot Twin";
  const r5 = mark(21, 24); r5[0] = "Portfolio + 求职";
  addRows(s, [r1, r2, r3, r4, r5]);
  autosize(s, [28, ...Array(24).fill(4)]);
}

// ---------- Sheet8: GitHub Commit 计划 ----------
{
  const s = workbook.addWorksheet("08-GitHub-Commit计划");
  s.addRow(["项目", "月份", "建议 Commit 信息", "类型"]);
  styleHeader(s.getRow(1));
  addRows(s, [
    ["P1", "M1", "init: create React Three Fiber project", "init"],
    ["P1", "M1", "feat: add basic 3D scene", "feat"],
    ["P1", "M1", "feat: add camera controller", "feat"],
    ["P1", "M2", "feat: add CNC model / load GLTF assets", "feat"],
    ["P1", "M2", "optimize: reduce mesh complexity", "perf"],
    ["P1", "M3", "feat: add machine interaction / selection / info panel", "feat"],
    ["P1", "M4", "feat: add exploded animation / machine configuration", "feat"],
    ["P1", "M4", "refactor: 3D state management", "refactor"],
    ["P1", "M5", "perf: optimize GLB / Draco / improve FPS", "perf"],
    ["P1", "M6", "docs: project documentation / architecture", "docs"],
    ["P1", "M6", "release: CNC Configurator V1.0", "release"],
    ["P2", "M7", "feat: add MQTT simulator / machine data model", "feat"],
    ["P2", "M8", "feat: create factory scene / machine twin object", "feat"],
    ["P2", "M9", "feat: websocket communication / sync realtime status", "feat"],
    ["P2", "M10", "feat: alarm system / production dashboard", "feat"],
    ["P2", "M11", "feat: temperature shader", "feat"],
    ["P2", "M11", "perf: optimize rendering pipeline", "perf"],
    ["P2", "M12", "docker: containerize application", "chore"],
    ["P2", "M12", "release: Machine Monitoring V1", "release"],
    ["P3", "M13", "feat: create digital twin engine / asset registry", "feat"],
    ["P3", "M14", "feat: factory environment / production line", "feat"],
    ["P3", "M15", "feat: bind realtime data / update 3D object state", "feat"],
    ["P3", "M16", "feat: OPC-UA simulator / industrial protocol layer", "feat"],
    ["P3", "M17", "perf: large scene / instancing / LOD", "perf"],
    ["P3", "M18", "release: Smart Factory Digital Twin V1", "release"],
    ["P3", "M18", "docs: add system architecture", "docs"],
    ["P4", "M19", "feat: import robot model / joint controller", "feat"],
    ["P4", "M20", "feat: simulate robot motion / TCP trajectory", "feat"],
    ["P4", "M20", "release: Robot Twin V1", "release"],
  ]);
  autosize(s, [8, 8, 60, 10]);
}

// ---------- Sheet9: 评估摘要 ----------
{
  const s = workbook.addWorksheet("09-可行性评估摘要");
  s.addRow(["结论项", "内容"]);
  styleHeader(s.getRow(1));
  addRows(s, [
    ["总评", "4 个项目整体可行，但必须串成一条能力线，禁止 4 个仓库平行从零开始。"],
    ["P1", "可行：营销向 3D 配置器，利于美国远程；注意别做成纯炫技 Demo，要有配置状态与部署。"],
    ["P2", "强烈建议作为主线：你已有 IMC（MQTT→WS→面板），与路线表 M7-M12 高度重合，应继续深化而非重开。"],
    ["P3", "可行但易膨胀：应定义为 P2 的「单车间→可扩展 Twin Engine」升级，不做全厂 Omniverse。"],
    ["P4", "可行做 2 个月 MVP：六轴可视化+关节+简单轨迹；ROS2 只学概念/可选，不承诺完整生态。"],
    ["最大风险", "时间表过满（每日 6h×24月）+ 德英双线 + 4 大项目；若精力不足，砍 P1 商业报价或推迟 P4。"],
    ["与当前仓库", "industrial-monitoring-center = P2 起步；P3/P4 以模块演进；P1 可另仓。"],
    ["详细评估", "见同目录 feasibility-assessment.md"],
  ]);
  autosize(s, [14, 90]);
  s.getColumn(2).alignment = { wrapText: true };
}

workbook.xlsx.writeFile(outFile).then(() => {
  console.log("Wrote", outFile);
});
