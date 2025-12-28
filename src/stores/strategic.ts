import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StrategicTask, StrategicIndicator, Milestone, StatusAuditEntry } from '@/types'
import { useTimeContextStore } from './timeContext'
import { allHistoricalIndicators } from '@/data/historicalIndicators'

export const useStrategicStore = defineStore('strategic', () => {
  // State
  const tasks = ref<StrategicTask[]>([
    {
      id: '1',
      title: '全力促进毕业生多元化高质量就业创业',
      desc: '围绕毕业生就业质量提升，多措并举促进高质量就业创业',
      createTime: '2025年12月14日',
      cycle: '2025年度',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      status: 'active',
      createdBy: 'admin',
      indicators: [],
      year: 2025,
      isRecurring: true // 长久性任务，每年持续
    },
    {
      id: '2',
      title: '推进校友工作提质增效，赋能校友成长',
      desc: '建立完善校友工作机制，提升校友服务质量',
      createTime: '2025年12月14日',
      cycle: '2025年度',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      status: 'active',
      createdBy: 'admin',
      indicators: [],
      year: 2025,
      isRecurring: true // 长久性任务
    },
    {
      id: '3',
      title: '根据学校整体部署',
      desc: '按照学校整体战略部署推进信息化建设等相关工作',
      createTime: '2025年12月14日',
      cycle: '2025年度',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      status: 'active',
      createdBy: 'admin',
      indicators: [],
      year: 2025,
      isRecurring: false // 非长久性任务
    }
  ])

  const indicators = ref<StrategicIndicator[]>([
    // ============ 发展性指标 - 战略任务1：全力促进毕业生多元化高质量就业创业 ============
    // 一级指标：职能部门
    {
      id: '101',
      name: '优质就业比例不低于15%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 45,
      createTime: '2025年12月14日',
      weight: 20,
      remark: '力争突破',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '1001', name: 'Q1: 就业数据摸底', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '1002', name: 'Q2: 优质就业渠道拓展', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '1003', name: 'Q3: 就业质量跟踪', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '1004', name: 'Q4: 目标达成验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 15,
      unit: '%',
      responsibleDept: '就业创业指导中心',
      responsiblePerson: '张老师',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部',
      year: 2025,
      statusAudit: [
        {
          id: 'audit-101-1',
          timestamp: new Date('2025-03-01'),
          operator: 'zhangsan',
          operatorName: '张老师',
          operatorDept: '就业创业指导中心',
          action: 'submit',
          comment: '提交Q1进度25%',
          previousProgress: 0,
          newProgress: 25
        },
        {
          id: 'audit-101-2',
          timestamp: new Date('2025-03-02'),
          operator: 'admin',
          operatorName: '战略发展部管理员',
          operatorDept: '战略发展部',
          action: 'approve',
          comment: '审批通过'
        }
      ]
    },
    {
      id: '102',
      name: '就业率达90%，教育厅公布的就业数据排名川内同类民办院校前三',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 60,
      createTime: '2025年12月14日',
      weight: 50,
      remark: '中长期发展规划内容',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '1021', name: 'Q1: 就业数据收集', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '1022', name: 'Q2: 各学院配合统计', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '1023', name: 'Q3: 就业率评估与调整', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '1024', name: 'Q4: 最终达标率90%', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 90,
      unit: '%',
      responsibleDept: '就业创业指导中心',
      responsiblePerson: '李老师',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部',
      year: 2025
    },
    {
      id: '103',
      name: '针对各学院开设专业引进优质校招企业（各专业大类不低于2家）',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 30,
      createTime: '2025年12月14日',
      weight: 20,
      remark: '根据学校发展现状',
      canWithdraw: true,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '1031', name: 'Q1: 企业调研与需求分析', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '1032', name: 'Q2: 优质企业对接洽谈', targetProgress: 50, deadline: '2025-06-30', status: 'pending' },
        { id: '1033', name: 'Q3: 校园招聘会组织', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '1034', name: 'Q4: 全专业覆盖完成', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 2,
      unit: '家/专业',
      responsibleDept: '招生工作处',
      responsiblePerson: '王主任',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 二级指标：学院级（下发自职能部门）
    {
      id: '101-1',
      name: '计算机学院优质就业比例不低于18%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 72,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '工科学院就业质量要求更高',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10111', name: 'Q1: 优质就业企业对接', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10112', name: 'Q2: 学生能力提升培训', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '10113', name: 'Q3: 就业质量跟踪调查', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '10114', name: 'Q4: 目标达成验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 18,
      unit: '%',
      responsibleDept: '计算机学院',
      responsiblePerson: '赵院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '101',
      statusAudit: [
        {
          id: 'audit-101-1-1',
          timestamp: new Date('2025-12-01'),
          operator: 'jyc-admin',
          operatorName: '就业中心管理员',
          operatorDept: '就业创业指导中心',
          action: 'distribute',
          comment: '下发子指标'
        },
        {
          id: 'audit-101-1-2',
          timestamp: new Date('2025-12-15'),
          operator: 'zhao-dean',
          operatorName: '赵院长',
          operatorDept: '计算机学院',
          action: 'submit',
          comment: '提交进度72%',
          previousProgress: 0,
          newProgress: 72
        }
      ]
    },
    {
      id: '101-2',
      name: '商学院优质就业比例不低于12%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 58,
      createTime: '2025年12月14日',
      weight: 20,
      remark: '商科专业就业质量稳步提升',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10121', name: 'Q1: 校企合作洽谈', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10122', name: 'Q2: 实习基地建设', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '10123', name: 'Q3: 就业推荐与跟进', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '10124', name: 'Q4: 达标验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 12,
      unit: '%',
      responsibleDept: '商学院',
      responsiblePerson: '钱院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '101',
      statusAudit: [
        {
          id: 'audit-101-2-1',
          timestamp: new Date('2025-12-01'),
          operator: 'jyc-admin',
          operatorName: '就业中心管理员',
          operatorDept: '就业创业指导中心',
          action: 'distribute',
          comment: '下发子指标'
        },
        {
          id: 'audit-101-2-2',
          timestamp: new Date('2025-12-10'),
          operator: 'qian-dean',
          operatorName: '钱院长',
          operatorDept: '商学院',
          action: 'submit',
          comment: '提交进度58%',
          previousProgress: 0,
          newProgress: 58
        },
        {
          id: 'audit-101-2-3',
          timestamp: new Date('2025-12-12'),
          operator: 'jyc-admin',
          operatorName: '就业中心管理员',
          operatorDept: '就业创业指导中心',
          action: 'approve',
          comment: '审批通过，进度达标'
        }
      ]
    },
    {
      id: '101-3',
      name: '艺术与科技学院优质就业比例不低于10%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 35,
      createTime: '2025年12月14日',
      weight: 15,
      remark: '艺术类专业就业质量提升',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10131', name: 'Q1: 就业市场调研', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10132', name: 'Q2: 企业对接与洽谈', targetProgress: 50, deadline: '2025-06-30', status: 'pending' },
        { id: '10133', name: 'Q3: 学生作品展示推介', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '10134', name: 'Q4: 目标达成', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 10,
      unit: '%',
      responsibleDept: '艺术与科技学院',
      responsiblePerson: '孙院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '101',
      statusAudit: [
        {
          id: 'audit-101-3-1',
          timestamp: new Date('2025-12-01'),
          operator: 'jyc-admin',
          operatorName: '就业中心管理员',
          operatorDept: '就业创业指导中心',
          action: 'distribute',
          comment: '下发子指标'
        }
      ]
    },
    {
      id: '101-4',
      name: '工学院优质就业比例不低于16%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 68,
      createTime: '2025年12月14日',
      weight: 22,
      remark: '工科类专业就业质量要求高',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10141', name: 'Q1: 优质企业对接', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10142', name: 'Q2: 学生技能培训', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '10143', name: 'Q3: 就业质量跟踪', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '10144', name: 'Q4: 目标达成验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 16,
      unit: '%',
      responsibleDept: '工学院',
      responsiblePerson: '李院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '101',
      statusAudit: [
        {
          id: 'audit-101-4-1',
          timestamp: new Date('2025-12-01'),
          operator: 'jyc-admin',
          operatorName: '就业中心管理员',
          operatorDept: '就业创业指导中心',
          action: 'distribute',
          comment: '下发子指标'
        },
        {
          id: 'audit-101-4-2',
          timestamp: new Date('2025-12-08'),
          operator: 'li-dean',
          operatorName: '李院长',
          operatorDept: '工学院',
          action: 'submit',
          comment: '提交进度50%',
          previousProgress: 0,
          newProgress: 50
        },
        {
          id: 'audit-101-4-3',
          timestamp: new Date('2025-12-10'),
          operator: 'jyc-admin',
          operatorName: '就业中心管理员',
          operatorDept: '就业创业指导中心',
          action: 'reject',
          comment: '进度偏低，请加强跟进'
        }
      ]
    },
    {
      id: '101-5',
      name: '航空学院优质就业比例不低于17%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 82,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '航空专业就业质量优势明显',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10151', name: 'Q1: 航空企业洽谈', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10152', name: 'Q2: 专业技能培训', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '10153', name: 'Q3: 就业质量评估', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '10154', name: 'Q4: 目标达成', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 17,
      unit: '%',
      responsibleDept: '航空学院',
      responsiblePerson: '周院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '101',
      statusAudit: [
        {
          id: 'audit-101-5-1',
          timestamp: new Date('2025-12-01'),
          operator: 'jyc-admin',
          operatorName: '就业中心管理员',
          operatorDept: '就业创业指导中心',
          action: 'distribute',
          comment: '下发子指标'
        },
        {
          id: 'audit-101-5-2',
          timestamp: new Date('2025-12-20'),
          operator: 'zhou-dean',
          operatorName: '周院长',
          operatorDept: '航空学院',
          action: 'submit',
          comment: '提交进度82%',
          previousProgress: 0,
          newProgress: 82
        }
      ]
    },
    {
      id: '102-1',
      name: '计算机学院就业率达92%以上',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 78,
      createTime: '2025年12月14日',
      weight: 30,
      remark: '工科就业率目标更高',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10211', name: 'Q1: 就业数据统计', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10212', name: 'Q2: 就业困难学生帮扶', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '10213', name: 'Q3: 就业率提升专项行动', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '10214', name: 'Q4: 最终达标率92%', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 92,
      unit: '%',
      responsibleDept: '计算机学院',
      responsiblePerson: '赵院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '102'
    },
    {
      id: '102-2',
      name: '商学院就业率达90%以上',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 65,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '商科就业率稳步提升',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10221', name: 'Q1: 就业数据收集', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10222', name: 'Q2: 就业困难帮扶', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '10223', name: 'Q3: 就业推进', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '10224', name: 'Q4: 达标验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 90,
      unit: '%',
      responsibleDept: '商学院',
      responsiblePerson: '钱院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '102'
    },
    {
      id: '102-3',
      name: '文理学院就业率达88%以上',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 55,
      createTime: '2025年12月14日',
      weight: 20,
      remark: '文理综合类专业就业稳步提升',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10231', name: 'Q1: 就业调研', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10232', name: 'Q2: 帮扶推进', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '10233', name: 'Q3: 就业率提升', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '10234', name: 'Q4: 达标验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 88,
      unit: '%',
      responsibleDept: '文理学院',
      responsiblePerson: '吴院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '102'
    },
    {
      id: '102-4',
      name: '国际教育学院就业率达85%以上',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 72,
      createTime: '2025年12月14日',
      weight: 18,
      remark: '国际化专业就业多元化',
      canWithdraw: false,
      taskContent: '全力促进毕业生多元化高质量就业创业',
      milestones: [
        { id: '10241', name: 'Q1: 就业渠道拓展', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '10242', name: 'Q2: 双语就业指导', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '10243', name: 'Q3: 就业率评估', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '10244', name: 'Q4: 目标达成', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 85,
      unit: '%',
      responsibleDept: '国际教育学院',
      responsiblePerson: '郑院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '就业创业指导中心',
      parentIndicatorId: '102'
    },
    // ============ 基础性指标 - 战略任务2：推进校友工作提质增效，赋能校友成长 ============
    {
      id: '201',
      name: '1.建立完善校友反馈母校的工作机制；\n2.择优建立部分地区校友会并开展高质量活动；\n3.启动《延续以来校友建设发展计划》；\n4.拟定并实施《校友状况分析报告》，完成第一阶段任务；\n5.实现校友数据全面信息化。',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 40,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '中长期发展规划未完成内容',
      canWithdraw: false,
      taskContent: '推进校友工作提质增效，赋能校友成长',
      milestones: [
        { id: '2011', name: 'Q1: 校友工作机制建立', targetProgress: 20, deadline: '2025-03-31', status: 'completed' },
        { id: '2012', name: 'Q2: 地区校友会筹建', targetProgress: 40, deadline: '2025-06-30', status: 'completed' },
        { id: '2013', name: 'Q3: 校友发展计划启动', targetProgress: 70, deadline: '2025-09-30', status: 'pending' },
        { id: '2014', name: 'Q4: 校友数据全面信息化', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '学校综合办公室',
      responsiblePerson: '陈主任',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 二级学院指标：校友工作（由学校综合办公室下发）
    {
      id: '201-1',
      name: '计算机学院完善校友信息库，建立本学院校友联络机制',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 48,
      createTime: '2025年12月14日',
      weight: 20,
      remark: '工科学院校友资源丰富',
      canWithdraw: false,
      taskContent: '推进校友工作提质增效，赋能校友成长',
      milestones: [
        { id: '20111', name: 'Q1: 校友信息收集', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '20112', name: 'Q2: 校友联络机制建立', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '20113', name: 'Q3: 校友活动组织', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '20114', name: 'Q4: 数据入库完成', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '计算机学院',
      responsiblePerson: '赵院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '学校综合办公室',
      parentIndicatorId: '201'
    },
    {
      id: '201-2',
      name: '商学院建立区域校友会，开展校友返校日活动',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 38,
      createTime: '2025年12月14日',
      weight: 18,
      remark: '商科校友资源广泛',
      canWithdraw: false,
      taskContent: '推进校友工作提质增效，赋能校友成长',
      milestones: [
        { id: '20121', name: 'Q1: 区域校友摸底', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '20122', name: 'Q2: 校友会筹备', targetProgress: 50, deadline: '2025-06-30', status: 'pending' },
        { id: '20123', name: 'Q3: 校友返校日活动', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '20124', name: 'Q4: 校友会正式成立', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '商学院',
      responsiblePerson: '钱院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '学校综合办公室',
      parentIndicatorId: '201'
    },

    // ============ 基础性指标 - 战略任务3：根据学校整体部署 ============
    {
      id: '202',
      name: '信息化相关数据报送准确、及时、可靠',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 55,
      createTime: '2025年12月14日',
      weight: 5,
      remark: '加快提升信息化治理水平',
      canWithdraw: false,
      taskContent: '根据学校整体部署',
      milestones: [
        { id: '2021', name: 'Q1: 数据标准制定', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '2022', name: 'Q2: 报送流程优化', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '2023', name: 'Q3: 系统对接测试', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '2024', name: 'Q4: 全面运行验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '数字校园建设办公室',
      responsiblePerson: '刘工',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 二级学院指标：信息化数据报送（由数字校园建设办公室下发）
    {
      id: '202-1',
      name: '计算机学院按时准确报送教学、科研相关数据',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 68,
      createTime: '2025年12月14日',
      weight: 10,
      remark: '工科学院数据化意识强',
      canWithdraw: false,
      taskContent: '根据学校整体部署',
      milestones: [
        { id: '20211', name: 'Q1: 数据报送规范培训', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '20212', name: 'Q2: 系统对接调试', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '20213', name: 'Q3: 数据质量提升', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '20214', name: 'Q4: 全面合格验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '计算机学院',
      responsiblePerson: '赵院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '数字校园建设办公室',
      parentIndicatorId: '202'
    },
    {
      id: '202-2',
      name: '商学院建立数据报送责任人制度，确保数据准确',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 52,
      createTime: '2025年12月14日',
      weight: 8,
      remark: '建立数据报送规范',
      canWithdraw: false,
      taskContent: '根据学校整体部署',
      milestones: [
        { id: '20221', name: 'Q1: 责任人明确', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '20222', name: 'Q2: 报送制度建立', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '20223', name: 'Q3: 数据质量监控', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '20224', name: 'Q4: 验收达标', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '商学院',
      responsiblePerson: '钱院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '数字校园建设办公室',
      parentIndicatorId: '202'
    },
    {
      id: '202-3',
      name: '艺术学院完善数据采集流程，提升数据时效性',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 42,
      createTime: '2025年12月14日',
      weight: 6,
      remark: '提升数据报送及时性',
      canWithdraw: false,
      taskContent: '根据学校整体部署',
      milestones: [
        { id: '20231', name: 'Q1: 数据采集流程梳理', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '20232', name: 'Q2: 流程优化实施', targetProgress: 50, deadline: '2025-06-30', status: 'pending' },
        { id: '20233', name: 'Q3: 时效性提升', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '20234', name: 'Q4: 达标验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '艺术与科技学院',
      responsiblePerson: '孙院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '数字校园建设办公室',
      parentIndicatorId: '202'
    },

    // ============ 新增职能部门指标 ============

    // 教务处 - 教学质量提升
    {
      id: '301',
      name: '提升教学质量，课程优良率达85%以上',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 76,
      createTime: '2025年12月14日',
      weight: 30,
      remark: '中长期发展规划核心内容',
      canWithdraw: false,
      taskContent: '提升教学质量，深化教学改革',
      milestones: [
        { id: '3011', name: 'Q1: 教学质量调研', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '3012', name: 'Q2: 课程改革试点', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '3013', name: 'Q3: 教学质量提升', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '3014', name: 'Q4: 达标验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 85,
      unit: '%',
      responsibleDept: '教务处',
      responsiblePerson: '陈处长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },
    {
      id: '301-1',
      name: '计算机学院课程优良率达88%',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 85,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '工科专业教学质量领先',
      canWithdraw: false,
      taskContent: '提升教学质量，深化教学改革',
      milestones: [
        { id: '30111', name: 'Q1: 课程质量评估', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '30112', name: 'Q2: 教学方法改进', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '30113', name: 'Q3: 质量持续提升', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '30114', name: 'Q4: 目标达成', targetProgress: 100, deadline: '2025-12-31', status: 'completed' }
      ],
      targetValue: 88,
      unit: '%',
      responsibleDept: '计算机学院',
      responsiblePerson: '赵院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '教务处',
      parentIndicatorId: '301'
    },
    {
      id: '301-2',
      name: '工学院课程优良率达86%',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 82,
      createTime: '2025年12月14日',
      weight: 24,
      remark: '工科教学质量稳步提升',
      canWithdraw: false,
      taskContent: '提升教学质量，深化教学改革',
      milestones: [
        { id: '30121', name: 'Q1: 质量分析', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '30122', name: 'Q2: 改革实施', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '30123', name: 'Q3: 质量跟踪', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '30124', name: 'Q4: 达标验收', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 86,
      unit: '%',
      responsibleDept: '工学院',
      responsiblePerson: '李院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '教务处',
      parentIndicatorId: '301'
    },

    // 科技处 - 科研成果提升
    {
      id: '302',
      name: '提升科研水平，年度发表高水平论文不少于50篇',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 62,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '科研水平提升关键指标',
      canWithdraw: false,
      taskContent: '提升科研水平，增强学术影响力',
      milestones: [
        { id: '3021', name: 'Q1: 科研项目立项', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '3022', name: 'Q2: 科研成果培育', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '3023', name: 'Q3: 论文撰写指导', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '3024', name: 'Q4: 目标达成', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 50,
      unit: '篇',
      responsibleDept: '科技处',
      responsiblePerson: '林处长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },
    {
      id: '302-1',
      name: '计算机学院发表高水平论文不少于15篇',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 73,
      createTime: '2025年12月14日',
      weight: 30,
      remark: '理工科科研优势明显',
      canWithdraw: false,
      taskContent: '提升科研水平，增强学术影响力',
      milestones: [
        { id: '30211', name: 'Q1: 科研项目推进', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '30212', name: 'Q2: 成果积累', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '30213', name: 'Q3: 论文发表', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '30214', name: 'Q4: 目标达成', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 15,
      unit: '篇',
      responsibleDept: '计算机学院',
      responsiblePerson: '赵院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '科技处',
      parentIndicatorId: '302'
    },

    // 党委学工部 - 学生工作
    {
      id: '303',
      name: '加强学生思想政治教育，学生满意度达90%以上',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 88,
      createTime: '2025年12月14日',
      weight: 20,
      remark: '立德树人根本任务',
      canWithdraw: false,
      taskContent: '加强学生工作，提升育人质量',
      milestones: [
        { id: '3031', name: 'Q1: 学生调研摸底', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '3032', name: 'Q2: 思政活动开展', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '3033', name: 'Q3: 效果评估', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '3034', name: 'Q4: 满意度调查', targetProgress: 100, deadline: '2025-12-31', status: 'completed' }
      ],
      targetValue: 90,
      unit: '%',
      responsibleDept: '党委学工部 | 学生工作处',
      responsiblePerson: '王部长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },
    {
      id: '303-1',
      name: '马克思主义学院思政教育满意度达95%',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 94,
      createTime: '2025年12月14日',
      weight: 30,
      remark: '思政教育专业优势',
      canWithdraw: false,
      taskContent: '加强学生工作，提升育人质量',
      milestones: [
        { id: '30311', name: 'Q1: 教学质量提升', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '30312', name: 'Q2: 实践活动开展', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '30313', name: 'Q3: 效果巩固', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '30314', name: 'Q4: 满意度调查', targetProgress: 100, deadline: '2025-12-31', status: 'completed' }
      ],
      targetValue: 95,
      unit: '%',
      responsibleDept: '马克思主义学院',
      responsiblePerson: '张院长',
      status: 'active',
      isStrategic: false,
      ownerDept: '党委学工部 | 学生工作处',
      parentIndicatorId: '303'
    },

    // 招生工作处 - 招生质量
    {
      id: '304',
      name: '提升生源质量，一志愿录取率达75%以上',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 68,
      createTime: '2025年12月14日',
      weight: 22,
      remark: '生源质量提升关键',
      canWithdraw: false,
      taskContent: '提升招生质量，扩大办学影响力',
      milestones: [
        { id: '3041', name: 'Q1: 招生宣传策划', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '3042', name: 'Q2: 招生宣传实施', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '3043', name: 'Q3: 招生录取', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '3044', name: 'Q4: 数据统计分析', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 75,
      unit: '%',
      responsibleDept: '招生工作处',
      responsiblePerson: '刘处长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // ============ 更多职能部门指标 ============

    // 党委办公室 | 党委统战部
    {
      id: '401',
      name: '加强党建工作，党员发展质量达标率95%以上',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 92,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '党建引领发展',
      canWithdraw: false,
      taskContent: '加强党的建设，提升组织凝聚力',
      milestones: [
        { id: '4011', name: 'Q1: 党员发展计划制定', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4012', name: 'Q2: 党员培训实施', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4013', name: 'Q3: 党员考核评估', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4014', name: 'Q4: 年度总结', targetProgress: 100, deadline: '2025-12-31', status: 'completed' }
      ],
      targetValue: 95,
      unit: '%',
      responsibleDept: '党委办公室 | 党委统战部',
      responsiblePerson: '李书记',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },
    {
      id: '402',
      name: '统战工作覆盖率达100%，民主党派联络机制完善',
      isQualitative: true,
      type1: '定性',
      type2: '基础性',
      progress: 85,
      createTime: '2025年12月14日',
      weight: 20,
      remark: '统一战线工作',
      canWithdraw: false,
      taskContent: '加强党的建设，提升组织凝聚力',
      milestones: [
        { id: '4021', name: 'Q1: 统战对象摸底', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4022', name: 'Q2: 联络机制建立', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4023', name: 'Q3: 活动开展', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4024', name: 'Q4: 工作总结', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '党委办公室 | 党委统战部',
      responsiblePerson: '李书记',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 纪委办公室 | 监察处
    {
      id: '403',
      name: '廉政教育覆盖率100%，违纪违规案件处理及时率100%',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 100,
      createTime: '2025年12月14日',
      weight: 30,
      remark: '全面从严治党',
      canWithdraw: false,
      taskContent: '加强纪检监察，营造风清气正环境',
      milestones: [
        { id: '4031', name: 'Q1: 廉政教育计划', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4032', name: 'Q2: 教育活动实施', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4033', name: 'Q3: 监督检查', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4034', name: 'Q4: 年度总结', targetProgress: 100, deadline: '2025-12-31', status: 'completed' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '纪委办公室 | 监察处',
      responsiblePerson: '张纪委',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 党委宣传部 | 宣传策划部
    {
      id: '404',
      name: '校园文化活动覆盖率达90%，新媒体传播影响力提升30%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 78,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '提升学校品牌影响力',
      canWithdraw: false,
      taskContent: '加强宣传工作，提升学校影响力',
      milestones: [
        { id: '4041', name: 'Q1: 宣传计划制定', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4042', name: 'Q2: 新媒体平台建设', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4043', name: 'Q3: 品牌活动策划', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4044', name: 'Q4: 效果评估', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 30,
      unit: '%',
      responsibleDept: '党委宣传部 | 宣传策划部',
      responsiblePerson: '王部长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 党委组织部 | 党委教师工作部 | 人力资源部
    {
      id: '405',
      name: '教师队伍建设，高层次人才引进不少于10人',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 60,
      createTime: '2025年12月14日',
      weight: 30,
      remark: '人才强校战略',
      canWithdraw: false,
      taskContent: '加强人才队伍建设，提升师资水平',
      milestones: [
        { id: '4051', name: 'Q1: 人才需求调研', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4052', name: 'Q2: 招聘计划实施', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4053', name: 'Q3: 人才引进', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '4054', name: 'Q4: 目标达成', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 10,
      unit: '人',
      responsibleDept: '党委组织部 | 党委教师工作部 | 人力资源部',
      responsiblePerson: '陈部长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 党委保卫部 | 保卫处
    {
      id: '406',
      name: '校园安全事故零发生，安全隐患整改率100%',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 95,
      createTime: '2025年12月14日',
      weight: 35,
      remark: '平安校园建设',
      canWithdraw: false,
      taskContent: '加强校园安全管理，保障师生安全',
      milestones: [
        { id: '4061', name: 'Q1: 安全隐患排查', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4062', name: 'Q2: 隐患整改', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4063', name: 'Q3: 安全演练', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4064', name: 'Q4: 年度评估', targetProgress: 100, deadline: '2025-12-31', status: 'completed' }
      ],
      targetValue: 100,
      unit: '%',
      responsibleDept: '党委保卫部 | 保卫处',
      responsiblePerson: '刘处长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 财务部
    {
      id: '407',
      name: '预算执行率达95%以上，财务合规率100%',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 88,
      createTime: '2025年12月14日',
      weight: 30,
      remark: '财务规范管理',
      canWithdraw: false,
      taskContent: '加强财务管理，提升资金使用效率',
      milestones: [
        { id: '4071', name: 'Q1: 预算编制', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4072', name: 'Q2: 预算执行监控', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4073', name: 'Q3: 财务审计', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4074', name: 'Q4: 年度决算', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 95,
      unit: '%',
      responsibleDept: '财务部',
      responsiblePerson: '赵部长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 实验室建设管理处
    {
      id: '408',
      name: '实验室利用率达85%以上，设备完好率98%',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 82,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '实验教学保障',
      canWithdraw: false,
      taskContent: '加强实验室建设，提升实践教学质量',
      milestones: [
        { id: '4081', name: 'Q1: 设备检修', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4082', name: 'Q2: 实验室升级', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4083', name: 'Q3: 利用率提升', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4084', name: 'Q4: 年度评估', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 85,
      unit: '%',
      responsibleDept: '实验室建设管理处',
      responsiblePerson: '孙处长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 图书馆 | 档案馆
    {
      id: '409',
      name: '图书馆资源利用率提升20%，数字资源访问量增长30%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 72,
      createTime: '2025年12月14日',
      weight: 20,
      remark: '文献资源建设',
      canWithdraw: false,
      taskContent: '加强图书馆建设，提升服务质量',
      milestones: [
        { id: '4091', name: 'Q1: 资源采购', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4092', name: 'Q2: 数字化建设', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4093', name: 'Q3: 服务推广', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4094', name: 'Q4: 效果评估', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 30,
      unit: '%',
      responsibleDept: '图书馆 | 档案馆',
      responsiblePerson: '周馆长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 后勤资产处
    {
      id: '410',
      name: '后勤服务满意度达90%以上，资产管理规范率100%',
      isQualitative: false,
      type1: '定量',
      type2: '基础性',
      progress: 86,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '后勤保障服务',
      canWithdraw: false,
      taskContent: '提升后勤服务质量，保障校园运行',
      milestones: [
        { id: '4101', name: 'Q1: 服务调研', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4102', name: 'Q2: 服务改进', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4103', name: 'Q3: 资产盘点', targetProgress: 75, deadline: '2025-09-30', status: 'completed' },
        { id: '4104', name: 'Q4: 满意度调查', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 90,
      unit: '%',
      responsibleDept: '后勤资产处',
      responsiblePerson: '吴处长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 继续教育部
    {
      id: '411',
      name: '继续教育招生人数增长15%，培训项目满意度达85%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 68,
      createTime: '2025年12月14日',
      weight: 22,
      remark: '继续教育发展',
      canWithdraw: false,
      taskContent: '拓展继续教育，服务社会发展',
      milestones: [
        { id: '4111', name: 'Q1: 市场调研', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4112', name: 'Q2: 项目开发', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4113', name: 'Q3: 招生推广', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '4114', name: 'Q4: 效果评估', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 15,
      unit: '%',
      responsibleDept: '继续教育部',
      responsiblePerson: '郑部长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部'
    },

    // 国际合作与交流处
    {
      id: '412',
      name: '国际合作项目新增3个，留学生招生增长20%',
      isQualitative: false,
      type1: '定量',
      type2: '发展性',
      progress: 55,
      createTime: '2025年12月14日',
      weight: 25,
      remark: '国际化办学',
      canWithdraw: false,
      taskContent: '推进国际化办学，提升国际影响力',
      milestones: [
        { id: '4121', name: 'Q1: 合作洽谈', targetProgress: 25, deadline: '2025-03-31', status: 'completed' },
        { id: '4122', name: 'Q2: 项目签约', targetProgress: 50, deadline: '2025-06-30', status: 'completed' },
        { id: '4123', name: 'Q3: 留学生招生', targetProgress: 75, deadline: '2025-09-30', status: 'pending' },
        { id: '4124', name: 'Q4: 项目实施', targetProgress: 100, deadline: '2025-12-31', status: 'pending' }
      ],
      targetValue: 3,
      unit: '个',
      responsibleDept: '国际合作与交流处',
      responsiblePerson: '钱处长',
      status: 'active',
      isStrategic: true,
      ownerDept: '战略发展部',
      year: 2025,
      statusAudit: []
    },
    // 合并历史数据
    ...allHistoricalIndicators
  ])

  // Getters
  const activeTasks = computed(() => tasks.value.filter(t => t.status === 'active'))
  const activeIndicators = computed(() => indicators.value.filter(i => i.status === 'active'))

  const getTaskById = (id: string) => tasks.value.find(t => t.id === id)
  const getIndicatorById = (id: string) => indicators.value.find(i => i.id === id)

  const getIndicatorsByTask = (taskId: string) => {
    const task = getTaskById(taskId)
    return task?.indicators || []
  }

  // 获取逾期的里程碑
  const getOverdueMilestones = computed(() => {
    const now = new Date()
    const overdue: Array<{ indicator: StrategicIndicator; milestone: Milestone }> = []
    
    indicators.value.forEach(indicator => {
      indicator.milestones.forEach(milestone => {
        if (milestone.status === 'pending') {
          const deadline = new Date(milestone.deadline)
          if (deadline < now) {
            overdue.push({ indicator, milestone })
          }
        }
      })
    })
    
    return overdue
  })

  // 获取即将到期的里程碑（30天内）
  const getUpcomingMilestones = computed(() => {
    const now = new Date()
    const upcoming: Array<{ indicator: StrategicIndicator; milestone: Milestone }> = []
    
    indicators.value.forEach(indicator => {
      indicator.milestones.forEach(milestone => {
        if (milestone.status !== 'completed') {
          const deadline = new Date(milestone.deadline)
          const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          if (daysUntilDeadline > 0 && daysUntilDeadline <= 30) {
            upcoming.push({ indicator, milestone })
          }
        }
      })
    })
    
    return upcoming
  })

  // Actions
  const addTask = (task: StrategicTask) => {
    tasks.value.push(task)
  }

  const updateTask = (id: string, updates: Partial<StrategicTask>) => {
    const task = getTaskById(id)
    if (task) {
      Object.assign(task, updates)
    }
  }

  const deleteTask = (id: string) => {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tasks.value.splice(index, 1)
    }
  }

  const addIndicator = (indicator: StrategicIndicator) => {
    indicators.value.push(indicator)
  }

  const updateIndicator = (id: string, updates: Partial<StrategicIndicator>) => {
    const indicator = getIndicatorById(id)
    if (indicator) {
      Object.assign(indicator, updates)
    }
  }

  const deleteIndicator = (id: string) => {
    const index = indicators.value.findIndex(i => i.id === id)
    if (index !== -1) {
      indicators.value.splice(index, 1)
    }
  }

  const updateMilestoneStatus = (indicatorId: string, milestoneId: string, status: 'pending' | 'completed' | 'overdue') => {
    const indicator = getIndicatorById(indicatorId)
    if (indicator) {
      const milestone = indicator.milestones.find(m => m.id === milestoneId)
      if (milestone) {
        milestone.status = status
      }
    }
  }

  // ============ 时间上下文相关 ============

  // 获取时间上下文 Store（延迟获取避免循环依赖）
  const getTimeContext = () => useTimeContextStore()

  // 按当前年份过滤的任务
  const tasksByCurrentYear = computed(() => {
    const timeContext = getTimeContext()
    return tasks.value.filter(t => t.year === timeContext.currentYear)
  })

  // 按当前年份过滤的指标
  const indicatorsByCurrentYear = computed(() => {
    const timeContext = getTimeContext()
    return indicators.value.filter(i => i.year === timeContext.currentYear)
  })

  // 初始化：确保所有指标都有 year 和 statusAudit 字段
  const initializeIndicatorFields = () => {
    indicators.value.forEach(indicator => {
      // 如果没有 year 字段，默认为 2025
      if (!indicator.year) {
        indicator.year = 2025
      }
      // 如果没有 statusAudit 字段，初始化为空数组
      if (!indicator.statusAudit) {
        indicator.statusAudit = []
      }
    })
  }

  // 添加审计日志条目
  const addStatusAuditEntry = (
    indicatorId: string,
    entry: Omit<StatusAuditEntry, 'id' | 'timestamp'>
  ) => {
    const indicator = getIndicatorById(indicatorId)
    if (indicator) {
      if (!indicator.statusAudit) {
        indicator.statusAudit = []
      }
      indicator.statusAudit.push({
        ...entry,
        id: `audit-${indicatorId}-${Date.now()}`,
        timestamp: new Date()
      })
    }
  }

  // 初始化字段
  initializeIndicatorFields()

  return {
    // State
    tasks,
    indicators,

    // Getters
    activeTasks,
    activeIndicators,
    getTaskById,
    getIndicatorById,
    getIndicatorsByTask,
    getOverdueMilestones,
    getUpcomingMilestones,
    // 按年份过滤
    tasksByCurrentYear,
    indicatorsByCurrentYear,

    // Actions
    addTask,
    updateTask,
    deleteTask,
    addIndicator,
    updateIndicator,
    deleteIndicator,
    updateMilestoneStatus,
    addStatusAuditEntry,
    initializeIndicatorFields
  }
})
