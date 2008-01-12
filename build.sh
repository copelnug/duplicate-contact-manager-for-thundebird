#!/usr/bin/bash
# clean build directory
# current dir is "duplicate-contact-manager-for-thunderbird"
rm -rf build
mkdir build

# copy install.rdf and chrome.manifest
cd src || exit
# current dir is "duplicate-contact-manager-for-thunderbird/src"

cp "chrome.manifest" ../build/
cp "install.rdf" ../build/
cp -r chrome ../build/
cp -r locale ../build/
cp -r skin ../build/

cd ../build || exit
# current dir is "duplicate-contact-manager-for-thunderbird/build"

# remove SVN directories
find . -type d -name ".svn" | xargs rm -rf

# remove backup files
find . -name "*~" | xargs rm -f

# remove .jEdit marks files
find . -name "*.marks" | xargs rm -f

zip -r duplicatecontactsmanager.zip *

cd ..
# current dir is "duplicate-contact-manager-for-thunderbird"

mv build/duplicatecontactsmanager.zip .

# rename zip to xpi
DATE=$(date +"%Y%m%d-%H%M")
mv duplicatecontactsmanager.zip duplicate-contact-manager-$DATE-tb.xpi

