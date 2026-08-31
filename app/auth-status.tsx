import { Cloud, LogIn, LogOut } from 'lucide-react';

import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from './chatgpt-auth';

export default async function AuthStatus() {
  const user = await getChatGPTUser();
  return (
    <aside className={`cloud-account-chip ${user ? 'signed-in' : ''}`} aria-label="云端同步账号">
      <Cloud aria-hidden="true" />
      <span><b>{user ? '云端同步中' : '仅保存在本机'}</b><small>{user ? user.displayName : '登录后可跨设备同步'}</small></span>
      <a href={user ? chatGPTSignOutPath('/') : chatGPTSignInPath('/')} target="_top">
        {user ? <><LogOut aria-hidden="true" />退出</> : <><LogIn aria-hidden="true" />登录</>}
      </a>
    </aside>
  );
}
