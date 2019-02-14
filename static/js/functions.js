/**
 * 放一些通用的函数
 */

PROTOCOL = {
  P_EXIT      : 0x01,
  P_LOGIN     : 0x02,
  P_SESSION   : 0x03,
  P_LOGOUT    : 0x04,
  P_FORCE_EXIT: 0x05,
  P_RESIZE    : 0x06,
};


TERM_ID = 1;
/**
 * 生成一个UUID
 */
function UUID() {
  return TERM_ID++;
}


function hover(ele, callback, clear_callback=null) {
  ele.addEventListener("mouseenter", (event) => {
    callback();
  });
  if (!clear_callback) return;
  ele.addEventListener('mouseleave', (event) => {
    clear_callback();
  });
}

exports.UUID = UUID;
exports.hover = hover;
exports.PROTOCOL = PROTOCOL;