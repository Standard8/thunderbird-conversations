/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export class ContextMenus {
  async init() {
    console.log("init");
    browser.menus.create(
      {
        id: "test",
        title: "Yay",
        contexts: ["all"],
      },
      () => console.log("yay")
    );
    browser.conversations.onContextMenu.addListener(() => {
      console.log("fired");
      browser.menus.overrideContext({
        showDefaults: false,
      });
      console.log("done override");
    });
    console.log("init done");
  }
}
