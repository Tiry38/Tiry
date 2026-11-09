local T=100 GetTime=function() return T end
local fight=false InCombatLockdown=function() return fight end UnitAffectingCombat=function() return fight end
issecretvalue=function() return false end
local aura={spellId=325,name="Blitzschlagschild",applications=3,expirationTime=T+590,duration=600}
local present=true
C_UnitAuras={GetAuraDataByIndex=function(u,i) if fight then error("blockiert") end if i==1 and present then return aura end end}
C_Spell={GetSpellName=function(id) return id==325 and "Blitzschlagschild" or "X" end}
local timers={} C_Timer={After=function(d,f) timers[#timers+1]=f end}
WeakAuras={ScanEvents=function() end}
aura_env={}
local f=dofile("chk3.lua") local S={}
local function run(label,ev,...) f(S,ev,...) local x=S[""]
  io.write(string.format("%-38s %s\n",label, x and x.show and ("KAMPF-ANZEIGE "..math.floor(x.expirationTime-T).."s  Ladungen "..(x.unsure and "?" or tostring(x.stacks))) or "– (eingebaute Erkennung zuständig)")) end
run("ausserhalb Kampf, Schild 3","UNIT_AURA","player",{})
fight=true run("Kampfbeginn","PLAYER_REGEN_DISABLED")
T=T+3 run("1. Treffer (Buff-Meldung gesperrt)","UNIT_AURA","player","GEHEIM")
T=T+3 run("2. Treffer","UNIT_AURA","player","GEHEIM")
T=T+5 run("im Kampf neu gezaubert","UNIT_SPELLCAST_SUCCEEDED","player","g",325)
run("  -> neuer Schild gemeldet","UNIT_AURA","player","GEHEIM")
T=T+4 run("Treffer am neuen Schild","UNIT_AURA","player","GEHEIM")
aura.applications=1 aura.expirationTime=T+589
fight=false run("Kampfende (Schild noch da, 1 Ladung)","PLAYER_REGEN_ENABLED")
present=false run("Schild weg (ausserhalb)","UNIT_AURA","player",{})
fight=true run("Kampf ohne Schild","PLAYER_REGEN_DISABLED")
