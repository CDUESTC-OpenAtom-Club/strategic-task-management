import dayjs from 'dayjs'
import { formatDate, formatDateChinese, safeFormatDate } from './src/shared/lib/format/date'

console.log('DayJS version:', dayjs.version)

const testDate = new Date('2026-03-12')
console.log('Date object:', testDate)
console.log('Date object valueOf():', testDate.valueOf())
console.log('Date object toISOString():', testDate.toISOString())
console.log('Date object getTime():', testDate.getTime())

console.log('\n--- formatDate ---')
console.log('formatDate(testDate):', formatDate(testDate))
console.log('formatDate(testDate.getTime()):', formatDate(testDate.getTime()))
console.log('formatDate(testDate.toISOString()):', formatDate(testDate.toISOString()))

console.log('\n--- formatDateChinese ---')
console.log('formatDateChinese(testDate):', formatDateChinese(testDate))

console.log('\n--- safeFormatDate ---')
console.log('safeFormatDate(testDate):', safeFormatDate(testDate))

console.log('\n--- dayjs directly ---')
console.log('dayjs(testDate):', dayjs(testDate).format('YYYY-MM-DD'))
console.log('dayjs(testDate.getTime()):', dayjs(testDate.getTime()).format('YYYY-MM-DD'))
console.log('dayjs(testDate.toISOString()):', dayjs(testDate.toISOString()).format('YYYY-MM-DD'))
