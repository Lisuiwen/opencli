import { CommandExecutionError } from '@jackwener/opencli/errors';

const ERROR_MESSAGES = {
  USER_CONTEXT_NOT_READY: '未获取到页面用户上下文：请确认当前浏览器已登录 RDM，且组织页已成功加载。',
  ORGANIZATION_ID_NOT_FOUND: '无法确定组织 ID：请确认当前页面位于目标组织上下文。',
  USER_ID_NOT_FOUND: '无法确定当前登录用户 ID：请确认页面会话完整且未失效。',
  ACCESS_TOKEN_NOT_FOUND: '未获取到 access_token：请先在 Chrome 中登录 RDM。',
  LIST_FETCH_FAILED: '列表接口请求失败：请确认登录态是否过期。',
  DETAIL_FETCH_FAILED: '详情接口请求失败：请确认登录态是否过期。',
  ISSUE_NOT_FOUND_IN_ACCESSIBLE_PROJECTS: '未在当前可访问项目中找到该 issue：请确认 issueId 正确，或补充 project-id。',
  LIST_CONTENT_EMPTY: '列表接口返回为空：可能是当前日期范围无数据，或接口路径已发生变化。',
  MEMBER_USER_ID_NOT_FOUND: '无法定位当前登录用户对应的成员数据。',
  EVALUATE_EXCEPTION: '页面执行异常。',
  INVALID_RDM_PAGE: '当前页面不是可用的 RDM 页面：请先在 Chrome 中打开 https://rdm.changan.com.cn/ 并完成登录。',
  DETAIL_STRUCTURE_INVALID: '详情接口返回结构异常：缺少 issues 列表。',
  DAILY_DATA_EMPTY: '未获取到每日预计工时：请确认日期范围内存在数据，或接口字段未发生变化。',
  UNKNOWN: '抓取失败：UNKNOWN',
};

export function buildRdmError(code, extra = '') {
  const message = `${ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN}${extra || ''}`;
  return new CommandExecutionError(message);
}
