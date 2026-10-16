import { useNavigate } from 'react-router-dom';
import { Btn } from '../components/ui';
import { I } from '../components/icons';

export default function NotFound() {
  const nav = useNavigate();
  return (
    <div className="empty" style={{ padding: '12vh 20px' }}>
      <div style={{ font: '700 72px/1 var(--font-sans)', background: 'linear-gradient(135deg, var(--md-primary), var(--md-tertiary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>404</div>
      <div style={{ font: 'var(--text-title-lg)' }}>页面走丢了</div>
      <div className="muted" style={{ marginBottom: 18 }}>你要找的页面不存在或已被删除</div>
      <Btn variant="filled" onClick={() => nav('/')}><I name="home" size={17} /> 返回首页</Btn>
    </div>
  );
}
