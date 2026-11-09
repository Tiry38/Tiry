local T=100 GetTime=function() return T end
local fight=false InCombatLockdown=function() return fight end UnitAffectingCombat=function() return fight end
local SECRET=setmetatable({},{}) issecretvalue=function(v) return v==SECRET end
local auras={} local locked=false
local function view(a) if locked then return {spellId=SECRET,name=SECRET,applications=SECRET,expirationTime=SECRET,duration=SECRET,auraInstanceID=a.auraInstanceID} end return a end
C_UnitAuras={GetAuraDataByIndex=function(u,i) local a=auras[i] return a and view(a) end,
 GetAuraDataByAuraInstanceID=function(u,id) for _,a in ipairs(auras) do if a.auraInstanceID==id then return view(a) end end end}
WeakAuras={GetTriggerStateForTrigger=function() return {} end}
C_Spell={GetSpellName=function(id) return id==10432 and "Blitzschlagschild" or "X" end}
print=function(...) io.write("   PRINT: ", table.concat({...}," "), "\n") end
aura_env={id="x"}
local f=dofile("chk2.lua") local S={}
local function run(label,ev,...) f(S,ev,...) local x=S[""] io.write(string.format("%-34s %s\n",label, x and x.show and ("ANZEIGE "..math.floor(x.expirationTime-T).."s  Ladungen "..tostring(x.stacks)) or "– (Ausloeser 1 zustaendig)")) end
auras={{spellId=10432,name="Blitzschlagschild",applications=3,expirationTime=T+590,duration=600,auraInstanceID=77}}
run("Schild da, ausserhalb Kampf","UNIT_AURA","player",{isFullUpdate=true})
fight=true locked=true run("Kampfbeginn","PLAYER_REGEN_DISABLED")
auras[1].applications=2 run("1. Treffer (Ladung weg)","UNIT_AURA","player",{updatedAuraInstanceIDs={77}})
run("anderer Buff aendert sich","UNIT_AURA","player",{updatedAuraInstanceIDs={12}})
auras[1].applications=1 run("2. Treffer","UNIT_AURA","player",{updatedAuraInstanceIDs={77}})
T=T+5 run("im Kampf neu gezaubert","UNIT_SPELLCAST_SUCCEEDED","player","g",10432)
auras={{spellId=10432,name="Blitzschlagschild",applications=3,expirationTime=T+600,duration=600,auraInstanceID=91}}
run("  -> Aura ersetzt","UNIT_AURA","player",{removedAuraInstanceIDs={77},addedAuras={view(auras[1])}})
T=T+3 auras[1].applications=2 run("Treffer am neuen Schild","UNIT_AURA","player",{updatedAuraInstanceIDs={91}})
auras[1].applications=1 run("Treffer","UNIT_AURA","player",{updatedAuraInstanceIDs={91}})
auras={} run("letzte Ladung weg","UNIT_AURA","player",{removedAuraInstanceIDs={91}})
fight=false locked=false run("Kampfende","PLAYER_REGEN_ENABLED")
