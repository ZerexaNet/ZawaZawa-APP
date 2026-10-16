import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { legal } from '../lib/api';
import { Markdown } from '../components/Markdown';
import { Btn, Loading } from '../components/ui';
import { I } from '../components/icons';
import { useNavigate } from 'react-router-dom';

const TITLES: Record<string, string> = { tos: '服务条款', privacy: '隐私政策' };

export default function LegalPage() {
  const { type } = useParams<{ type: string }>();
  const nav = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    legal.doc(type || 'tos').then((d: any) => {
      setContent(d?.content || (typeof d === 'string' ? d : JSON.stringify(d, null, 2)));
    }).catch(() => setContent('文档加载失败')).finally(() => setLoading(false));
  }, [type]);

  return (
    <div className="fade-in" style={{ maxWidth: 780, margin: '0 auto', width: '100%' }}>
      <div className="row" style={{ gap: 10, marginBottom: 6 }}>
        <Btn variant="text" size="sm" onClick={() => nav(-1 as any)}><I name="back" size={16} /> 返回</Btn>
      </div>
      <div className="card" style={{ padding: '26px 30px' }}>
        <h1 className="row" style={{ gap: 10, marginBottom: 18, font: 'var(--text-display-sm)' }}>
          <I name="scale" size={28} style={{ color: 'var(--md-primary)' }} /> {TITLES[type || ''] || '法律文档'}
        </h1>
        {loading ? <Loading /> : <Markdown content={content} />}
      </div>
    </div>
  );
}
