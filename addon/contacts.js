/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export class Contacts {
  constructor() {
    this._cache = new Map();
    this._colorCache = new Map();
  }

  async init() {
    this._showCondensed = await browser.conversations.getCorePref(
      "mail.showCondensedAddresses"
    );
    browser.conversations.onCorePrefChanged.addListener((value) => {
      browser.conversations.resetMessagePane().catch(console.error);
      this._showCondensed = value;
      this._cache.clear();
    }, "mail.showCondensedAddresses");

    browser.contacts.onCreated.addListener((node, id) => {
      // If the color cache has the email, drop it so that we check the
      // address book next time we need it.
      if (this._colorCache.has(node.properties.PrimaryEmail)) {
        this._colorCache.delete(node.properties.PrimaryEmail);
      }
      if (this._colorCache.has(node.properties.SecondEmail)) {
        this._colorCache.delete(node.properties.SecondEmail);
      }
    });
    browser.contacts.onUpdated.addListener((node) => {
      // If the cache has the email, drop it so that we check the
      // address book next time we need it.
      if (this._cache.has(node.properties.PrimaryEmail)) {
        this._cache.delete(node.properties.PrimaryEmail);
      }
      if (this._cache.has(node.properties.SecondEmail)) {
        this._cache.delete(node.properties.SecondEmail);
      }
    });
    browser.contacts.onDeleted.addListener((id) => {
      // If the color cache has the email, drop it so that we check the
      // address book next time we need it.
      let emails = [];
      for (let contact of this._cache.values()) {
        if (contact.contactId == id) {
          emails.push(contact.email);
        }
      }
      for (let email of emails) {
        if (this._cache.has(email)) {
          this._cache.delete(email);
        }
        if (this._cache.has(email)) {
          this._cache.delete(email);
        }
      }
    });
  }

  async get(name, email, position) {
    // [name] and [email] are from the message header
    email = (email + "").toLowerCase();
    // Might change in the future... who knows? ...
    let key = email;
    if (this._cache.has(key)) {
      return Contacts.enrichWithName(this._cache.get(key), name);
    }
    if (this._colorCache.has(key)) {
      // It is in the color cache, so we know that we don't have an address
      // book entry for it, so just form a contact from what we have.
      return Contacts.enrichWithName(this._colorCache.get(key), name);
    }

    // Nothing cached, so we must look it up.
    let matchingCards = [];
    // See #1492. This attempts to catch errors from quickSearch that can
    // happen if there are broken address books.
    try {
      matchingCards = await browser.contacts.quickSearch(email);
    } catch (ex) {
      console.error(ex);
    }
    let identityEmails = await this._getIdentityEmails();
    if (matchingCards.length) {
      let contact = new Contact(name, email, {
        ...matchingCards[0].properties,
        id: matchingCards[0].id,
      });
      for (let contactEmail of contact.emails) {
        let data = contact.getData(
          contactEmail,
          position,
          identityEmails,
          this._showCondensed
        );
        if (contactEmail) {
          this._cache.set(contactEmail.toLowerCase(), data);
        }
      }
      return this._cache.get(key);
    }

    let contact = new Contact(name, email);
    let data = contact.getData(
      email,
      position,
      identityEmails,
      this._showCondensed
    );
    this._colorCache.set(key, data);
    return data;
  }

  async _getIdentityEmails() {
    if (this._identityEmails) {
      return this._identityEmails;
    }
    const identityEmails = await browser.convContacts
      .getIdentityEmails({ includeNntpIdentities: false })
      .catch(console.error);
    this._identityEmails = identityEmails.map((e) => e.toLowerCase());
    return this._identityEmails;
  }

  static enrichWithName(contactData, name) {
    if ((contactData.name == contactData.email || !contactData.name) && name) {
      contactData.name = name;
    }
    return contactData;
  }
}

class Contact {
  constructor(name, email, card = null, color = null) {
    // Initialise to the original email, but it may be changed in fetch().
    this.emails = [email];
    this.color = color || this._freshColor(email);

    this._name = name; // Initially, the displayed name. Might be enhanced later.
    this._email = email; // The original email. Use to pick a gravatar.
    this._card = card;
    this._useCardName = false;

    this._determineDisplayNameAndEmail();
  }

  /**
   * Gets the summary data for a contact.
   *
   * @param {string} email
   *  The specific email to use for the contact.
   * @param {string} position
   *  If the contact is in the "from" or "to" position on the email.
   * @param {array} identityEmails
   *  The array of identity emails.
   * @param {boolean} showCondensed
   *  True if we are showing condensed addresses.
   */
  getData(email, position, identityEmails, showCondensed) {
    const lcEmail = this._email.toLowerCase();
    const hasIdentity = identityEmails.find((e) => e == lcEmail);

    // `name` and `extra` are the only attributes that depend on `position`
    let name = this._name || this._email;
    let extra = "";
    if (hasIdentity) {
      name =
        position === "from"
          ? browser.i18n.getMessage("message.meFromMeToSomeone")
          : browser.i18n.getMessage("message.meFromSomeoneToMe");
      extra = this._email;
    }
    const displayEmail = name != email ? email : "";

    return {
      name,
      initials: this.getInitials(name),
      displayEmail: this._card && showCondensed ? "" : displayEmail,
      email,
      avatar: this.avatar,
      contactId: this._card ? this._card.id : null,
      extra,
      colorStyle: { backgroundColor: this.color },
    };
  }

  get avatar() {
    if (this._card) {
      let photoURI = this._card.PhotoURI || "";
      if (photoURI) {
        return photoURI;
      }
    }

    // It would be nice to return null here and let the UI sort out the default.
    // However, with the current version comparisons, that makes it hard to do.

    // setDefaultIdentity was introduced in 76beta. png to svg was in 78, but
    // this seems close enough.
    if ("setDefaultIdentity" in browser.accounts) {
      return "chrome://messenger/skin/addressbook/icons/contact-generic.svg";
    }
    return "chrome://messenger/skin/addressbook/icons/contact-generic.png";
  }

  /**
   * Hash an email address to produce a color. The same email address will
   * always return the same color.
   *
   * @param {string} email
   * @returns {string} - valid css hsl(...) string
   */
  _freshColor(email) {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      let chr = email.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash &= 0xffff;
    }
    let hue = Math.floor((360 * hash) / 0xffff);

    // try to provide a consistent lightness across hues
    let lightnessStops = [48, 25, 28, 27, 62, 42];
    let j = Math.floor(hue / 60);
    let l1 = lightnessStops[j];
    let l2 = lightnessStops[(j + 1) % 6];
    let lightness = Math.floor((hue / 60 - j) * (l2 - l1) + l1);

    return "hsl(" + hue + ", 70%, " + Math.floor(lightness) + "%)";
  }

  _determineDisplayNameAndEmail() {
    if (this._card) {
      // PreferDisplayName returns a literal string "0" or "1". We must convert it
      // to a boolean appropriately.
      this._useCardName =
        this._card.PreferDisplayName != null
          ? !!+this._card.PreferDisplayName
          : true;
      this.emails = [this._card.PrimaryEmail, this._card.SecondEmail || ""];
      // Prefer:
      // - displayName
      // - firstName lastName (if one of these is non-empty)
      // - the parsed name
      // - the email
      if (this._useCardName) {
        if (this._card.DisplayName) {
          this._name = this._card.DisplayName;
        } else {
          if (this._card.FirstName) {
            this._name = this._card.FirstName;
          }
          if (this._card.LastName) {
            if (this._name) {
              this._name += " " + this._card.LastName;
            } else {
              this._name = this._card.LastName;
            }
          }
        }
      }
      if (!this._name) {
        this._name = this._email;
      }
    } else {
      this.emails = [this._email];
      this._name = this._name || this._email;
    }
  }

  /**
   * Take a name and extract initials from it.
   * If `name` is an email address, get the part before the @.
   * Then, capitalize the first letter of the first and last word (or the first
   * two letters of the first word if only one exists).
   *
   * @param {string} name
   * @returns {string}
   */
  getInitials(name) {
    name = name.trim().split("@")[0];
    let words = name.split(/[ .\-_]/).filter(function (word) {
      return word;
    });
    let initials = "??";
    let n = words.length;
    if (n == 1) {
      initials = words[0].substr(0, 2);
    } else if (n > 1) {
      initials =
        this.fixedCharAt(words[0], 0) + this.fixedCharAt(words[n - 1], 0);
    }
    return initials.toUpperCase();
  }

  // Taken from
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charAt#Fixing_charAt()_to_support_non-Basic-Multilingual-Plane_(BMP)_characters
  fixedCharAt(str, idx) {
    var ret = "";
    str += "";
    var end = str.length;

    var surrogatePairs = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
    while (surrogatePairs.exec(str) != null) {
      var li = surrogatePairs.lastIndex;
      if (li - 2 < idx) {
        idx++;
      } else {
        break;
      }
    }

    if (idx >= end || idx < 0) {
      return "";
    }

    ret += str.charAt(idx);

    if (
      /[\uD800-\uDBFF]/.test(ret) &&
      /[\uDC00-\uDFFF]/.test(str.charAt(idx + 1))
    ) {
      // Go one further, since one of the "characters" is part of a surrogate pair
      ret += str.charAt(idx + 1);
    }
    return ret;
  }
}
