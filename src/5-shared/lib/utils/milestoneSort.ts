type SortableMilestone = {
  targetProgress?: number | null
  deadline?: string | null
  dueDate?: string | null
  sortOrder?: number | null
}

const toNumericProgress = (value: number | null | undefined) => {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

const toTime = (value?: string | null) => {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

export const sortMilestonesByProgress = <T extends SortableMilestone>(milestones: T[]): T[] => {
  return [...milestones].sort((a, b) => {
    const progressDiff = toNumericProgress(a.targetProgress) - toNumericProgress(b.targetProgress)
    if (progressDiff !== 0) {
      return progressDiff
    }

    const dateDiff =
      toTime(a.deadline ?? a.dueDate) - toTime(b.deadline ?? b.dueDate)
    if (dateDiff !== 0) {
      return dateDiff
    }

    return Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
  })
}
