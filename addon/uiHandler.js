/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { browser as CompatBrowser } from "./content/es-modules/thunderbird-compat.js";

if (!globalThis.browser) {
  globalThis.browser = CompatBrowser;
}

export class UIHandler {
  constructor() {
    this._identities = null;
  }

  async init() {
    browser.commands.onCommand.addListener(this.onKeyCommand.bind(this));
    if ("messageViews" in browser) {
      try {
        await browser.messageViews.addCustomColumn({
          name: browser.i18n.getMessage("between.columnName"),
          tooltip: browser.i18n.getMessage("between.columnTooltip"),
        });
      } catch (ex) {
        console.error(ex);
      }
      browser.messageViews.onCustomColumnFill.addListener(async (hdr) => {
        let participants = await this.getParticipants(hdr);
        return {
          cellText: participants,
          sortString: participants,
        };
      }, browser.i18n.getMessage("between.columnName"));
      this._participantStrings = {
        betweenMeAndSomeone: browser.i18n.getMessage(
          "message.meBetweenMeAndSomeone"
        ),
        betweenSomeoneAndMe: browser.i18n.getMessage(
          "message.meBetweenSomeoneAndMe"
        ),
        commaSeparator: browser.i18n.getMessage("header.commaSeparator"),
        andSeparator: browser.i18n.getMessage("header.andSeparator"),
      };
    } else {
      browser.convContacts.onColumnHandler.addListener(
        () => {},
        browser.i18n.getMessage("between.columnName"),
        browser.i18n.getMessage("between.columnTooltip"),
        browser.i18n.getMessage("message.meBetweenMeAndSomeone"),
        browser.i18n.getMessage("message.meBetweenSomeoneAndMe"),
        browser.i18n.getMessage("header.commaSeparator"),
        browser.i18n.getMessage("header.andSeparator")
      );
    }
  }

  onKeyCommand(command) {
    if (command == "quick_compose") {
      this.openQuickCompose().catch(console.error);
    }
  }

  async openQuickCompose() {
    let win = await browser.windows.getCurrent({ populate: true });
    let identityId;
    let accountId;
    if (win.type == "normal") {
      let [tab] = win.tabs.filter((t) => t.active);
      if (tab) {
        let msgs;
        if ("getDisplayedMessages" in browser.messageDisplay) {
          msgs = await browser.messageDisplay.getDisplayedMessages(tab.id);
        } else {
          msgs = await browser.convMsgWindow.getDisplayedMessages(tab.id);
        }
        if (msgs && msgs.length) {
          let accountDetail = await browser.accounts.get(
            msgs[0].folder.accountId
          );
          if (accountDetail && accountDetail.identities.length) {
            accountId = accountDetail.id;
            identityId = accountDetail.identities[0].id;
          }
        }
      }
    }
    if (!identityId) {
      [accountId, identityId] = await this.getDefaultIdentity();
    }
    // The title/description for this pref is really confusing, we should
    // reconsider it when we re-enable.
    const result = await browser.storage.local.get("preferences");
    const url = `compose/compose.html?accountId=${accountId}&identityId=${identityId}`;
    if (result.preferences.compose_in_tab) {
      browser.tabs.create({
        url,
      });
    } else {
      browser.windows.create({
        url,
        type: "popup",
        width: 1024,
        height: 600,
      });
    }
  }

  async getDefaultIdentity() {
    let accounts = await browser.accounts.list();
    return [accounts[0].id, accounts[0].identities[0].id];
  }

  async getIdentityEmails() {
    if (this._identities) {
      return this._identities;
    }

    this._identities = new Set();
    let accounts = await browser.accounts.list();
    for (let account of accounts) {
      if (account.type != "imap" && account.type != "pop3") {
        continue;
      }
      for (let identity of account.identities) {
        if (identity.email) {
          this._identities.add(identity.email.toLowerCase());
        }
      }
    }
    return this._identities;
  }

  async getParticipants(hdr) {
    try {
      // The set of people involved in this email.
      let people = new Set();
      // Helper for formatting; depending on the locale, we may need a different
      // for me as in "to me" or as in "from me".
      let identities = await this.getIdentityEmails();
      let format = (x, p) => {
        if (identities.has(x.email)) {
          let display = p
            ? this._participantStrings.betweenMeAndSomeone
            : this._participantStrings.betweenSomeoneAndMe;
          if (identities.size > 1) {
            display += " (" + x.email + ")";
          }
          return display;
        }
        return x.name || x.email;
      };
      // Add all the people found in one of the msgHdr's properties.
      let addPeople = async (prop, pos) => {
        for (let item of prop) {
          for (let x of await this.parseMimeLine(item)) {
            people.add(format(x, pos));
          }
        }
      };
      // We add everyone
      await addPeople([hdr.author], true);
      await addPeople(hdr.recipients, false);
      await addPeople(hdr.ccList, false);
      await addPeople(hdr.bccList, false);
      // And turn this into a human-readable line.
      if (people.size) {
        return this.joinWordList(people);
      }
    } catch (ex) {
      console.error("Error in the special column", ex);
    }
    return "-";
  }

  // Joins together names and format them as "John, Jane and Julie"
  joinWordList(aElements) {
    let l = aElements.size;
    if (l == 0) {
      return "";
    }
    let elements = [...aElements.values()];
    if (l == 1) {
      return elements[0];
    }

    let hd = elements.slice(0, l - 1);
    let tl = elements[l - 1];
    return (
      hd.join(this._participantStrings.commaSeparator) +
      this._participantStrings.andSeparator +
      tl
    );
  }

  async parseMimeLine(mimeLine) {
    if (mimeLine == null) {
      console.debug("Empty aMimeLine?!!");
      return [];
    }
    let addresses = await browser.conversations.parseEncodedHeader(mimeLine);
    if (addresses.length) {
      return addresses.map((addr) => {
        return {
          email: addr.email,
          name: addr.name,
        };
      });
    }
    return [];
  }
}
