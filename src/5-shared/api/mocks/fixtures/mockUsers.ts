import type { User, UserRole } from '@/5-shared/types/entities'

export const mockUsers: User[] = [
  {
    userId: 1,
    username: 'admin',
    name: '系统管理员',
    passwordHash: 'hashed_password',
    role: 'strategic_dept' as UserRole,
    department: '战略发展部',
    email: 'admin@sism.edu.cn',
    phone: '13800138000',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    userId: 2,
    username: 'kychu',
    name: '张三',
    passwordHash: 'hashed_password',
    role: 'functional_dept' as UserRole,
    department: '科研处',
    email: 'kychu@sism.edu.cn',
    phone: '13800138001',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    userId: 3,
    username: 'jsxy',
    name: '李四',
    passwordHash: 'hashed_password',
    role: 'secondary_college' as UserRole,
    department: '计算机学院',
    email: 'jsxy@sism.edu.cn',
    phone: '13800138002',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    userId: 4,
    username: 'jiaowuchu',
    name: '王五',
    passwordHash: 'hashed_password',
    role: 'functional_dept' as UserRole,
    department: '教务处',
    email: 'jiaowuchu@sism.edu.cn',
    phone: '13800138003',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    userId: 5,
    username: 'xueshengchu',
    name: '赵六',
    passwordHash: 'hashed_password',
    role: 'functional_dept' as UserRole,
    department: '学生处',
    email: 'xueshengchu@sism.edu.cn',
    phone: '13800138004',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  }
]
