/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/* eslint-env jest, node */

// Standard imports for all tests

const { esmImport, browser } = require("./utils");

global.browser = browser;

const { Contacts } = esmImport("../contacts.js");

describe("Contacts setup", () => {
  test("can be constructed", async () => {
    expect(new Contacts()).not.toBeNull();
  });

  test("can be initialized", async () => {
    let contacts = new Contacts();
    await contacts.init();
  });
});

describe("Getting unknown contacts", () => {
  let contacts = new Contacts();

  beforeAll(async () => {
    await contacts.init();
  });

  test("can get a contact object for an email", async () => {
    await expect(contacts.get("", "test@example.com", "from")).resolves.toEqual(
      {
        name: "test@example.com",
        initials: "TE",
        displayEmail: "",
        tooltipName: "",
        email: "test@example.com",
        avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
        contactId: null,
        extra: "",
        colorStyle: { backgroundColor: "hsl(11, 70%, 43%)" },
      }
    );
  });

  test("should return the same object when called a second time", async () => {
    await expect(contacts.get("", "test@example.com", "from")).resolves.toEqual(
      {
        name: "test@example.com",
        initials: "TE",
        displayEmail: "",
        tooltipName: "",
        email: "test@example.com",
        avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
        contactId: null,
        extra: "",
        colorStyle: { backgroundColor: "hsl(11, 70%, 43%)" },
      }
    );
  });

  test("should add a name for a cached contact if one is present", async () => {
    await expect(
      contacts.get("my name", "test@example.com", "from")
    ).resolves.toEqual({
      name: "my name",
      initials: "TE",
      displayEmail: "",
      tooltipName: "",
      email: "test@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: null,
      extra: "",
      colorStyle: { backgroundColor: "hsl(11, 70%, 43%)" },
    });
  });
});

describe("Getting known contacts", () => {
  let contacts = new Contacts();
  let listeners = new Map();

  beforeAll(async () => {
    jest
      .spyOn(browser.contacts.onCreated, "addListener")
      .mockImplementation((listener) => listeners.set("created", listener));
    jest
      .spyOn(browser.contacts.onUpdated, "addListener")
      .mockImplementation((listener) => listeners.set("updated", listener));
    jest
      .spyOn(browser.contacts.onDeleted, "addListener")
      .mockImplementation((listener) => listeners.set("deleted", listener));
    await contacts.init();
  });

  beforeEach(() => {
    jest.spyOn(browser.contacts, "quickSearch").mockImplementation((email) => {
      if (email == "contact@example.com" || email == "Second@example.com") {
        return Promise.resolve([
          {
            id: "1",
            properties: {
              FirstName: "first",
              LastName: "last",
              DisplayName: "contact name",
              PrimaryEmail: "contact@example.com",
              SecondEmail: "Second@example.com",
              PreferDisplayName: "1",
            },
            type: "contact",
            parentId: "2",
            readOnly: false,
          },
        ]);
      }
      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should get a contact from the address book", async () => {
    await expect(
      contacts.get("", "contact@example.com", "from")
    ).resolves.toEqual({
      name: "contact name",
      initials: "CN",
      displayEmail: "",
      tooltipName: "contact name",
      email: "contact@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "1",
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });
  });

  test("should cache contacts", async () => {
    await expect(
      contacts.get("", "contact@example.com", "from")
    ).resolves.toEqual({
      name: "contact name",
      initials: "CN",
      displayEmail: "",
      tooltipName: "contact name",
      email: "contact@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "1",
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });

    expect(browser.contacts.quickSearch).not.toHaveBeenCalled();
  });

  test("should also cache alternate emails of contacts", async () => {
    await expect(
      contacts.get("", "second@example.com", "from")
    ).resolves.toEqual({
      name: "contact name",
      initials: "CN",
      displayEmail: "",
      tooltipName: "contact name",
      email: "Second@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "1",
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });

    expect(browser.contacts.quickSearch).not.toHaveBeenCalled();
  });

  test("should correctly handle adding a contact", async () => {
    // Ensure the cache is primed.
    await expect(
      contacts.get("", "notab@example.com", "from")
    ).resolves.toEqual({
      name: "notab@example.com",
      initials: "NO",
      displayEmail: "",
      tooltipName: "",
      email: "notab@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: null,
      extra: "",
      colorStyle: { backgroundColor: "hsl(246, 70%, 60%)" },
    });
    let newContact = {
      id: "2",
      properties: {
        FirstName: "first",
        LastName: "last",
        DisplayName: "not ab",
        PrimaryEmail: "notab@example.com",
        SecondEmail: "",
        PreferDisplayName: "1",
      },
      type: "contact",
      parentId: "2",
      readOnly: false,
    };

    listeners.get("created")(newContact);
    jest
      .spyOn(browser.contacts, "quickSearch")
      .mockImplementation(() => Promise.resolve([newContact]));

    await expect(
      contacts.get("", "notab@example.com", "from")
    ).resolves.toEqual({
      name: "not ab",
      initials: "NA",
      displayEmail: "",
      tooltipName: "not ab",
      email: "notab@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "2",
      extra: "",
      colorStyle: { backgroundColor: "hsl(246, 70%, 60%)" },
    });
  });

  test("should update the contact if it changes", async () => {
    // Ensure the cache is primed.
    await contacts.get("", "contact@example.com", "from");
    let newContact = {
      id: "1",
      properties: {
        FirstName: "first",
        LastName: "last",
        DisplayName: "new display",
        PrimaryEmail: "contact@example.com",
        SecondEmail: "Second@example.com",
        PreferDisplayName: "1",
      },
      type: "contact",
      parentId: "2",
      readOnly: false,
    };

    listeners.get("updated")(newContact);
    jest
      .spyOn(browser.contacts, "quickSearch")
      .mockImplementation(() => Promise.resolve([newContact]));

    await expect(
      contacts.get("", "contact@example.com", "from")
    ).resolves.toEqual({
      name: "new display",
      initials: "ND",
      displayEmail: "",
      tooltipName: "new display",
      email: "contact@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "1",
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });
  });

  test("should remove deleted contacts from the cache", async () => {
    // Ensure the cache is primed.
    await expect(
      contacts.get("", "contact@example.com", "from")
    ).resolves.toEqual({
      name: "new display",
      initials: "ND",
      displayEmail: "",
      tooltipName: "new display",
      email: "contact@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: "1",
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });

    listeners.get("deleted")("1");
    jest
      .spyOn(browser.contacts, "quickSearch")
      .mockImplementation(() => Promise.resolve([]));

    await expect(
      contacts.get("", "contact@example.com", "from")
    ).resolves.toEqual({
      name: "contact@example.com",
      initials: "CO",
      displayEmail: "",
      tooltipName: "",
      email: "contact@example.com",
      avatar: "chrome://messenger/skin/addressbook/icons/contact-generic.png",
      contactId: null,
      extra: "",
      colorStyle: { backgroundColor: "hsl(4, 70%, 46%)" },
    });
  });
});

describe("Test contact initials", () => {
  let contacts = new Contacts();

  beforeAll(async () => {
    await contacts.init();
  });

  test("Extracts initials from names", async () => {
    const tests = [
      {
        name: "X",
        email: "X@example.com",
        expected: "X",
      },
      {
        name: "Tammy Smith",
        email: "foo1@example.com",
        expected: "TS",
      },
      {
        name: "tammy smith",
        email: "foo2@example.com",
        expected: "TS",
      },
      {
        name: "tammy smith jackson",
        email: "foo3@example.com",
        expected: "TJ",
      },
    ];

    for (let t of tests) {
      await expect(contacts.get(t.name, t.email, "from")).resolves.toEqual(
        expect.objectContaining({
          initials: t.expected,
        })
      );
    }
  });

  test("Handles wide characters", async () => {
    const tests = [
      {
        name: "明治天皇",
        email: "bar1@example.com",
        expected: "明治",
      },
      {
        name: "😍😏😊",
        email: "bar2@example.com",
        expected: "😍",
      },
    ];

    for (let t of tests) {
      await expect(contacts.get(t.name, t.email, "from")).resolves.toEqual(
        expect.objectContaining({
          initials: t.expected,
        })
      );
    }
  });

  test("getInitials interprets the first part of an email address as being a name", async () => {
    const tests = [
      {
        name: "",
        email: "sam@fake.com",
        expected: "SA",
      },
      {
        name: "",
        email: "same.wise@fake.com",
        expected: "SW",
      },
      {
        name: "",
        email: "same.wise+extra@fake.com",
        expected: "SW",
      },
    ];

    for (let t of tests) {
      await expect(contacts.get(t.name, t.email, "from")).resolves.toEqual(
        expect.objectContaining({
          initials: t.expected,
        })
      );
    }
  });

  test("freshColor turns an email into a valid hsl color", async () => {
    // From https://gist.github.com/olmokramer/82ccce673f86db7cda5e
    function isValidColor(color) {
      if (color.charAt(0) === "#") {
        color = color.substring(1);
        return (
          [3, 4, 6, 8].indexOf(color.length) > -1 && !isNaN(parseInt(color, 16))
        );
      }
      return /^(rgb|hsl)a?\((\d+%?(deg|rad|grad|turn)?[,\s]+){2,3}[\s\/]*[\d\.]+%?\)$/i.test(
        color
      );
    }

    let abc = await contacts.get("", "abc@fake.com", "from");
    let cbc = await contacts.get("", "cbc@fake.com", "from");

    // Outputs a valid css color
    expect(isValidColor(abc.colorStyle.backgroundColor)).toBe(true);
    expect(isValidColor(cbc.colorStyle.backgroundColor)).toBe(true);

    // Outputs different colors for different emails
    expect(abc.colorStyle.backgroundColor).not.toBe(
      cbc.colorStyle.backgroundColor
    );
  });
});
