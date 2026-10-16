s=open('top.html').read()+open('header.html').read()+open('body.html').read()+'<script>\n'+open('data.js').read()+'\n'+open('logic.js').read()+'</script></body></html>\n'
import re
assert 'Nonthaburi' not in s and not re.search(r'''(src|href)=["']?(https?:)?//''',s) and '@import' not in s and 'url(http' not in s
open('Teenager_Placement_Test_CEFR.html','w').write(s);print(len(s))
