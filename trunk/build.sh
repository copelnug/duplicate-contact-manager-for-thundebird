#!/usr/bin/bash
# clean build directory
# current dir is "ThunderbirdABookSync/duplicatecontactsmanager"
rm -rf build
mkdir build

# copy install.rdf and chrome.manifest
cd src || exit
# current dir is "ThunderbirdABookSync/duplicatecontactsmanager/src"
cp "chrome.manifest" ../build/
cp "install.rdf" ../build/
cp -r chrome ../build/
cp -r locale ../build/
cp -r skin ../build/

cd ../build || exit

find . -name "*~" | xargs rm
find . -name "*.marks" | xargs rm
find . -name "*.psd" | xargs rm

# current dir is "ThunderbirdABookSync/duplicatecontactsmanager/build"
zip -r duplicatecontactsmanager.zip *
cd ..
# current dir is "ThunderbirdABookSync/duplicatecontactsmanager"
mv build/duplicatecontactsmanager.zip .


# rename zip to xpi
mv duplicatecontactsmanager.zip "duplicate-contact-manager-0.3-tb.xpi"
