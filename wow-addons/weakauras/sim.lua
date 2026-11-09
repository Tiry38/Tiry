local T=100 GetTime=function() return T end
local secretMode=false
issecretvalue=function(v) return secretMode and type(v)=="table" end
local SECRET={}
local buffs={}
C_UnitAuras={GetBuffDataByIndex=function(u,i) local b=buffs[i] if not b then return nil end if secretMode then return {name=SECRET,spellId=SECRET} end return b end}
C_Spell={GetSpellName=function(id) return id==10432 and "Blitzschlagschild" or "X" end}
local fight=false InCombatLockdown=function() return fight end UnitAffectingCombat=function() return fight end
C_Timer={After=function() end} WeakAuras={ScanEvents=function() end}
aura_env={}
local f=dofile("chk.lua")
local function run(ev,...) local s={} f(s,ev,...) local x=s[""] print(ev, "active="..tostring(x.active), "stacks="..tostring(x.stacks), "rest="..(x.expirationTime>0 and math.floor(x.expirationTime-T) or 0)) end
run("STATUS")                                   -- kein Schild
buffs={{name="Blitzschlagschild",spellId=10432,applications=3,expirationTime=T+590,duration=600}}
run("UNIT_AURA","player")
fight=true secretMode=true buffs={} run("UNIT_AURA","player")   -- im Kampf, Werte gesperrt -> bleibt aktiv
T=T+700 run("TIRY_LS")                           -- abgelaufen
run("UNIT_SPELLCAST_SUCCEEDED","player","g",10432) -- im Kampf neu gezaubert
fight=false secretMode=false buffs={} T=T+5 run("PLAYER_REGEN_ENABLED") -- nach dem Kampf ohne Buff
