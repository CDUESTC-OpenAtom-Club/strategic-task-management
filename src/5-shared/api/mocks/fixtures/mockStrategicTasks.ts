import type { StrategicTask, TaskType } from '@/shared/types/entities'

export const mockStrategicTasks: StrategicTask[] = [
  {
    taskId: 1,
    cycleId: 1,
    taskName: '科研项目申报与管理',
    taskDesc: '负责组织和管理全校科研项目的申报、立项、中期检查和结题工作',
    taskType: '定量' as TaskType,
    responsibleDept: '科研处',
    weight: 30,
    targetValue: 100,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-10-15T14:30:00Z'
  },
  {
    taskId: 2,
    cycleId: 1,
    taskName: '教学质量提升工程',
    taskDesc: '提升教学质量，包括课程建设、教学改革、实践教学等',
    taskType: '定性' as TaskType,
    responsibleDept: '教务处',
    weight: 25,
    targetValue: null,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-11-20T10:15:00Z'
  },
  {
    taskId: 3,
    cycleId: 1,
    taskName: '人才培养质量提升',
    taskDesc: '提升学生培养质量，包括就业率、深造率、实习质量等',
    taskType: '定性' as TaskType,
    responsibleDept: '学生处',
    weight: 20,
    targetValue: null,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-11-20T10:15:00Z'
  },
  {
    taskId: 4,
    cycleId: 1,
    taskName: '师资队伍建设',
    taskDesc: '加强师资队伍建设，包括人才引进、培训、晋升等',
    taskType: '定量' as TaskType,
    responsibleDept: '人事处',
    weight: 15,
    targetValue: 50,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-10-25T09:00:00Z'
  },
  {
    taskId: 5,
    cycleId: 1,
    taskName: '校园基础设施建设',
    taskDesc: '改善校园基础设施，包括实验室建设、教学楼改造等',
    taskType: '定性' as TaskType,
    responsibleDept: '后勤处',
    weight: 10,
    targetValue: null,
    createdAt: '2025-09-01T09:00:00Z',
    updatedAt: '2025-11-10T16:45:00Z'
  }
]
