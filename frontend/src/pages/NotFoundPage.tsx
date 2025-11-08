import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <section className="grid flex-1 place-items-center">
    <div className="flex flex-col items-center gap-md rounded-lg bg-surface-white p-xl text-center shadow-md">
      <h1 className="text-3xl font-semibold text-primary-700">頁面不存在</h1>
      <p className="max-w-md text-base text-text-secondary">
        很抱歉，您造訪的頁面不存在或已被移除。請返回地圖或設定頁面繼續操作。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-sm">
        <Link
          to="/"
          className="rounded-md bg-primary-600 px-lg py-sm text-white shadow-md transition hover:bg-primary-700"
        >
          回到即時地圖
        </Link>
        <Link
          to="/settings"
          className="rounded-md border border-primary-300 px-lg py-sm text-primary-700 transition hover:bg-primary-50"
        >
          前往設定
        </Link>
      </div>
    </div>
  </section>
);

export default NotFoundPage;
