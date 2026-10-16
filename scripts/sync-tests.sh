#!/bin/sh
# Copy the latest standalone test sources into tests-src/, then build app/tests + web/tests.
set -e
cd "$(dirname "$0")/.."
W=${W:-/workspace}
[ -f "$W/adult_test/Adult_Placement_Test_CEFR.html" ] && cp "$W/adult_test/Adult_Placement_Test_CEFR.html" tests-src/adult.html
[ -f "$W/entry_test/Entry_Test_Ages_7-12.html" ] && cp "$W/entry_test/Entry_Test_Ages_7-12.html" tests-src/kids.html
[ -f "$W/phonics_test/Phonics_Entry_Test.html" ] && cp "$W/phonics_test/Phonics_Entry_Test.html" tests-src/phonics.html
[ -f "$W/teen_test/Teenager_Placement_Test_CEFR.html" ] && cp "$W/teen_test/Teenager_Placement_Test_CEFR.html" tests-src/teen.html
python3 scripts/build-tests.py
