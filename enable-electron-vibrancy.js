w = nodeRequire('electron').remote.getCurrentWindow();
w.setBackgroundColor('#000000');
// you should change the blur style if you like
// light，ultra-light, dark, ultra-dark
w.setVibrancy('light');
