local T=100 GetTime=function() return T end
local fight=false InCombatLockdown=function() return fight end UnitAffectingCombat=function() return fight end
local t1={} WeakAuras={GetTriggerStateForTrigger=function() return t1 end}
C_Spell={GetSpellName=function(id) return id==10432 and "Blitzschlagschild" or "X" end}
aura_env={id="x"}
local f=dofile("chk2.lua") local S={}
local function run(ev,...) f(S,ev,...) local x=S[""] print(ev, x and x.show and ("AKTIV "..math.floor(x.expirationTime-T).."s Ladungen "..tostring(x.stacks)) or "–") end
t1={[""]={show=true,expirationTime=T+500,duration=600,stacks=3}} run("UNIT_AURA","player")
fight=true run("PLAYER_REGEN_DISABLED")
t1={[""]={show=true}} run("UNIT_AURA","player")          -- im Kampf gesperrt
T=T+100 run("UNIT_SPELLCAST_SUCCEEDED","player","g",10432) -- neu gezaubert im Kampf
fight=false run("PLAYER_REGEN_ENABLED")
t1={[""]={show=true}} run("UNIT_AURA","player")           -- danach weg
fight=true run("PLAYER_REGEN_DISABLED")                    -- Kampf ohne Schild
