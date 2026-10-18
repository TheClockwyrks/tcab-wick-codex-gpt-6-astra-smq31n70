import json,subprocess,os
C=json.load(open('/tmp/constants.json'))
def run(tool,c,*args):subprocess.run([tool,'--config',c,*map(str,args)],check=True,stdout=subprocess.DEVNULL)
for i,(cue,path) in enumerate(C['CUE_PATHS'].items()):
 if cue=='music':continue
 cfg={'sample_rate':22050,'channels':'stereo','max_duration_ms':4000,'seed':8,'actions':'/tmp/art/sound-ops.json','preview':'/tmp/art/sound.png','wav':'/work/assets/'+path}
 c='/tmp/art/sound.json';json.dump(cfg,open(c,'w'));run('sfx-synth',c,'init');dur=2400 if cue=='hum' else 1100 if cue in ['dawn','fallen','evolve'] else 450 if cue in ['level-up','chest'] else 75+i*8
 freq=[210,360,960,110,520,660,420,780,880,130,440,600,740,110,110][i]
 run('sfx-synth',c,'add-voice','--name','body','--wave','triangle' if cue!='hum' else 'sine','--freq',freq,'--dur',dur,'--gain',-25 if cue=='hum' else -19)
 if cue!='hum':run('sfx-synth',c,'set-pitch','--voice','body','--slide-to',freq*(.4 if cue in ['hit','hurt','fallen'] else 1.5),'--over',dur)
 run('sfx-synth',c,'render')
c='/tmp/art/music.json';json.dump({'sample_rate':22050,'channels':'stereo','max_duration_ms':34000,'seed':8,'actions':'/tmp/art/music-ops.json','preview':'/tmp/art/music.png','wav':'/work/assets/audio/music.wav','mid':'/work/assets/audio/music.mid'},open(c,'w'))
run('music',c,'init');run('music',c,'set-tempo','--bpm',120)
for name,wave in [('bed','sine'),('bell','triangle')]:run('music',c,'define-track','--name',name,'--instrument',wave)
for bar,root in enumerate([45,48,43,40]*2):
 for pitch in [root,root+7,root+12]:run('music',c,'add-note','--track','bed','--pitch',pitch,'--t',bar*8,'--dur',8,'--velocity',35)
 for j in range(4):run('music',c,'add-note','--track','bell','--pitch',root+24+[0,7,3,12][j],'--t',bar*8+j*2,'--dur',1.5,'--velocity',48)
run('music',c,'render')
