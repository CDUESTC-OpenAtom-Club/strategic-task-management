import { describe, it, expect } from 'vitest'
import {
  STRATEGIC_DEPT,
  COLLEGES,
  FUNCTIONAL_DEPARTMENTS,
  ALL_DEPARTMENTS,
  getStrategicDept,
  getAllColleges,
  getAllFunctionalDepartments,
  getAllDepartments,
  isStrategicDept,
  isFunctionalDept,
  isCollege,
  isValidDepartment
} from '@/config/departments'
import { isSecondaryCollege } from '@/utils/colors'

describe('Department Configuration', () => {
  describe('Constants', () => {
    it('should have strategic department defined separately', () => {
      expect(STRATEGIC_DEPT).toBe('战略发展部')
    })

    it('should have correct number of colleges (8)', () => {
      expect(COLLEGES).toHaveLength(8)
      expect(COLLEGES).toContain('马克思主义学院')
      expect(COLLEGES).toContain('计算机学院')
      expect(COLLEGES).toContain('工学院')
    })

    it('should have correct number of functional departments (19, excluding 战略发展部)', () => {
      expect(FUNCTIONAL_DEPARTMENTS).toHaveLength(19)
      expect(FUNCTIONAL_DEPARTMENTS).not.toContain('战略发展部')
      expect(FUNCTIONAL_DEPARTMENTS).toContain('招生工作处')
      expect(FUNCTIONAL_DEPARTMENTS).toContain('就业创业指导中心')
      expect(FUNCTIONAL_DEPARTMENTS).toContain('教务处')
    })

    it('should have all departments combined (1 + 19 + 8 = 28)', () => {
      expect(ALL_DEPARTMENTS).toHaveLength(28)
      expect(ALL_DEPARTMENTS).toContain(STRATEGIC_DEPT)
    })
  })

  describe('Getter Functions', () => {
    it('getStrategicDept should return 战略发展部', () => {
      expect(getStrategicDept()).toBe('战略发展部')
    })

    it('getAllColleges should return all colleges', () => {
      const colleges = getAllColleges()
      expect(colleges).toHaveLength(8)
      expect(colleges).toEqual([...COLLEGES])
    })

    it('getAllFunctionalDepartments should return all functional departments (not including 战略发展部)', () => {
      const depts = getAllFunctionalDepartments()
      expect(depts).toHaveLength(19)
      expect(depts).not.toContain('战略发展部')
      expect(depts).toEqual([...FUNCTIONAL_DEPARTMENTS])
    })

    it('getAllDepartments should return all departments including 战略发展部', () => {
      const depts = getAllDepartments()
      expect(depts).toHaveLength(28)
      expect(depts).toContain('战略发展部')
      expect(depts).toEqual([...ALL_DEPARTMENTS])
    })
  })


  describe('Role Identification Functions', () => {
    it('isStrategicDept should identify 战略发展部 correctly', () => {
      expect(isStrategicDept('战略发展部')).toBe(true)
      expect(isStrategicDept('教务处')).toBe(false)
      expect(isStrategicDept('计算机学院')).toBe(false)
    })

    it('isFunctionalDept should identify functional departments correctly', () => {
      expect(isFunctionalDept('教务处')).toBe(true)
      expect(isFunctionalDept('招生工作处')).toBe(true)
      expect(isFunctionalDept('战略发展部')).toBe(false)
      expect(isFunctionalDept('计算机学院')).toBe(false)
    })

    it('isCollege should identify colleges correctly', () => {
      expect(isCollege('计算机学院')).toBe(true)
      expect(isCollege('马克思主义学院')).toBe(true)
      expect(isCollege('教务处')).toBe(false)
      expect(isCollege('战略发展部')).toBe(false)
    })
  })

  describe('Validation', () => {
    it('should validate college names correctly', () => {
      expect(isValidDepartment('计算机学院')).toBe(true)
      expect(isValidDepartment('商学院')).toBe(true)
      expect(isValidDepartment('不存在的学院')).toBe(false)
    })

    it('should validate functional department names correctly', () => {
      expect(isValidDepartment('招生工作处')).toBe(true)
      expect(isValidDepartment('教务处')).toBe(true)
      expect(isValidDepartment('不存在的部门')).toBe(false)
    })

    it('should validate 战略发展部 correctly', () => {
      expect(isValidDepartment('战略发展部')).toBe(true)
    })
  })

  describe('Integration with isSecondaryCollege', () => {
    it('should correctly identify colleges', () => {
      COLLEGES.forEach(college => {
        expect(isSecondaryCollege(college)).toBe(true)
      })
    })

    it('should correctly identify functional departments as not colleges', () => {
      FUNCTIONAL_DEPARTMENTS.forEach(dept => {
        expect(isSecondaryCollege(dept)).toBe(false)
      })
    })

    it('should correctly identify 战略发展部 as not college', () => {
      expect(isSecondaryCollege('战略发展部')).toBe(false)
    })
  })

  describe('Three-tier Permission Structure', () => {
    it('战略发展部 is the system admin (tier 1)', () => {
      expect(isStrategicDept(STRATEGIC_DEPT)).toBe(true)
      expect(isFunctionalDept(STRATEGIC_DEPT)).toBe(false)
      expect(isCollege(STRATEGIC_DEPT)).toBe(false)
    })

    it('职能部门 is the middle tier (tier 2)', () => {
      const sampleDept = '教务处'
      expect(isStrategicDept(sampleDept)).toBe(false)
      expect(isFunctionalDept(sampleDept)).toBe(true)
      expect(isCollege(sampleDept)).toBe(false)
    })

    it('二级学院 is the base tier (tier 3)', () => {
      const sampleCollege = '计算机学院'
      expect(isStrategicDept(sampleCollege)).toBe(false)
      expect(isFunctionalDept(sampleCollege)).toBe(false)
      expect(isCollege(sampleCollege)).toBe(true)
    })
  })

  describe('Department List Completeness', () => {
    it('should include all required colleges', () => {
      const requiredColleges = [
        '马克思主义学院',
        '工学院',
        '计算机学院',
        '商学院',
        '文理学院',
        '艺术与科技学院',
        '航空学院',
        '国际教育学院'
      ]

      requiredColleges.forEach(college => {
        expect(COLLEGES).toContain(college)
      })
    })

    it('should include all required functional departments', () => {
      const requiredDepts = [
        '党委办公室 | 党委统战部',
        '教务处',
        '招生工作处',
        '就业创业指导中心',
        '科技处',
        '财务部'
      ]

      requiredDepts.forEach(dept => {
        expect(FUNCTIONAL_DEPARTMENTS).toContain(dept)
      })
    })

    it('战略发展部 should NOT be in FUNCTIONAL_DEPARTMENTS', () => {
      expect(FUNCTIONAL_DEPARTMENTS).not.toContain('战略发展部')
    })
  })
})
