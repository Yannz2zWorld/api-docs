'use strict';
// Template welcome / left grup. Bisa diatur per grup (.setwelcome / .setleft) dengan placeholder
// @user, @group, @desc, @count.
const { jidUser } = require('../library/function');

const DEFAULT_WELCOME = 'Halo @user, selamat datang di *@group*! 👋\nKetik .menu untuk melihat fitur bot.';
const DEFAULT_LEFT = '@user telah meninggalkan *@group*. 👋';

function render(tpl, { user, group, desc = '', count = 0 }) {
  return String(tpl).replace(/@user/g, `@${jidUser(user)}`).replace(/@group/g, group).replace(/@desc/g, desc).replace(/@count/g, String(count));
}

module.exports = { render, DEFAULT_WELCOME, DEFAULT_LEFT };
