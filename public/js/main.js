document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  
  homeScreen.addEventListener('click', (e) => {
    const rect = homeScreen.getBoundingClientRect();
    const percentX = ((e.clientX - rect.left) / rect.width) * 100;
    const percentY = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (isInsideBodyZone(percentX, percentY)) {
      createPainDot(percentX, percentY);
      savePainDot(percentX, percentY);
      showHomeMessage('烦恼已经被忧忧接住了。');
      setTimeout(() => {
        goToChatScene();
      }, 1000);
    } else {
      showHomeMessage('请点击忧忧身上的位置来记录烦恼');
    }
  });
  
  UserStorage.logout();
  showAuthScreen();
});