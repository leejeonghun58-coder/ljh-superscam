import Link from 'next/link';

export default function Forbidden() {
  return <main className="access-error"><p className="eyebrow">403 FORBIDDEN</p><h1>접근 권한이 없습니다.</h1><p>관리자 권한이 필요한 화면입니다. 필요한 경우 관리자에게 권한을 요청해 주세요.</p><Link href="/">홈으로 돌아가기</Link></main>;
}
