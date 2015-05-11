## Introduction ##

Normally, add-ons are installed into Thunderbird as .XPI files (see HowToBuildFromSource for an instruction on how to build this file). During development, it is much simpler to test changes without having to build this file every time.

## Details ##

**WARNING: This description works under _Windows_. The folder locations might be different under Unix/Linux, since extensions might be filed under the user's home directory there.**

## 1. Uninstall the Duplicate Contact Manager Add-On ##

You cannot have several versions installed at the same time, so in case you alredy installed the Duplicate Contact Manager Add-On in the usual way, please uninstall it now.

## 2. Quit Thunderbird ##

Yeah, shut it down completely.

## 3. Locate Your Thunderbird Directory ##

First you have to find the place where the Thunderbird installer put it's program files. On Windows, this usually is

C:\Program Files\Mozilla\Thunderbird

## 4. Locate the extensions folder ##

In the program filder you should find a sub-directory named "**extensions**".

As mentioned above, this might differ on systems other than Windows.

## 5. Checkout the source ##

Being in the extension folder you just found, now you have to check out the source from SVN.

It is important not to checkout the entire trun, since this would create an unwanted folder. Instead, use the following URL to check out:

```
svn checkout https://duplicate-contact-manager-for-thundebird.googlecode.com/svn/trunk/%7bb4447f60-db9c-11da-a94d-0800200c9a66%7d/ --username [google_username]
```

If you don't want to commit any changes, e.g for testing only, you can use this anonymous command instead:

```
svn checkout http://duplicate-contact-manager-for-thundebird.googlecode.com/svn/trunk/%7bb4447f60-db9c-11da-a94d-0800200c9a66%7d/
```

You should have a directory like this now (you path might be different, of course):

**C:\Program Files\Mozilla\Thunderbird\extensions\{b4447f60-db9c-11da-a94d-0800200c9a66}**

Inside this folder, you should find the following contents:

```
./chrome            DIR
./locale            DIR
./skin              DIR
./chrome.manifest
./install.rdf
```

## 6. Start Thunderbird ##

Now, if everything worked well, Thunderbird should automatically load and activate the extension you loaded into the folder above.

You can now modify the source. Depending on the changes you make, in order to see the effects, you might have to close the "Find and handle duplicates" window (for changes within that window code), the Address Book (for changes in the menu) or completely restart Thunderbird (for changes in the extension meta data).