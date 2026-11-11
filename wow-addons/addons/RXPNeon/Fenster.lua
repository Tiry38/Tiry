-- RXPNeon: eigenes Guide-Fenster im LevelPilot-Stil. Zeigt, was RestedXP gerade will – klar sortiert:
-- Stufe + EP, Guide-Fortschritt, JETZT-Karte (aktive Schritte mit Haken), ALS NAECHSTES (kommende Schritte).
-- RXP selbst bleibt aktiv (sein Fenster wird nur unsichtbar), damit Auto-Annehmen/-Abgeben und Schritt-Logik laufen.
local N = RXPNeon
local MEDIA = "Interface\\AddOns\\RXPNeon\\Media\\"
local WHITE = "Interface\\Buttons\\WHITE8X8"
local FONT = "Fonts\\ARIALN.TTF"
local GREEN = { 0.224, 1.0, 0.420 }
local TEAL = { 0.176, 0.886, 0.902 }
local AQUA = { 0.30, 0.62, 1.0 }
local fmt, floor, max, min = string.format, math.floor, math.max, math.min
local W, PAD = 340, 14
local IW = W - 2 * PAD          -- Innenbreite

-- Schritt-Arten: Farbe + Wort (wie LevelPilot: Annehmen gelb, Abgeben blau, Erledigen gruen)
local TYPE = {
  accept   = { c = { 1.00, 0.82, 0.25 }, de = "ANNEHMEN" },
  turnin   = { c = { 0.40, 0.78, 1.00 }, de = "ABGEBEN" },
  complete = { c = GREEN,                de = "ERLEDIGEN" },
  fly      = { c = TEAL,                 de = "FLIEGEN" },
  hearth   = { c = { 1.00, 0.62, 0.30 }, de = "RUHESTEIN" },
  go       = { c = { 0.80, 0.88, 0.92 }, de = "LAUFEN" },
  train    = { c = { 0.78, 0.56, 1.00 }, de = "LERNEN" },
  grind    = { c = { 1.00, 0.45, 0.40 }, de = "EP SAMMELN" },
  note     = { c = { 0.70, 0.78, 0.80 }, de = "HINWEIS" },
}
local TAG = {
  accept = "accept", daily = "accept", turnin = "turnin",
  complete = "complete", collect = "complete", mob = "complete", use = "complete", unitscan = "complete",
  buy = "complete", itemcount = "complete", cast = "complete", emote = "complete",
  fly = "fly", fp = "fly", taxi = "fly",
  hs = "hearth", home = "hearth", bindlocation = "hearth",
  ["goto"] = "go", zone = "go", zoneskip = "go", subzone = "go",
  train = "train", trainer = "train", skill = "train",
  xp = "grind", vendor = "note", deathskip = "go",
}
-- Rang: welches Element bestimmt die Art des Schritts
local RANK = { turnin = 9, accept = 8, complete = 7, fly = 6, hearth = 5, train = 4, grind = 3, go = 2, note = 1 }
local function TypeOf(el) return el and el.tag and TAG[el.tag] end

-- Blizzard-Spielsymbole (Atlas) wie in LevelPilot; ohne Atlas eigene Grafik
local ATLAS = {
  accept   = { "QuestNormal", "Quest-Campaign-Available" },
  turnin   = { "QuestTurnin", "Quest-Campaign-TurnIn" },
  complete = { "QuestObjective", "Crosshair_Quest_48" },
  fly      = { "FlightMaster", "TaxiNode_Neutral" },
  hearth   = { "Innkeeper", "poi-town" },
  go       = { "Waypoint-MapPin-Tracked", "poi-door" },
  train    = { "Profession", "Class" },
  grind    = { "Crosshair_Attack_48" },
  note     = { "poi-workorders" },
}
local atlasOK = {}
local function SetIcon(tex, typ)
  local hit = atlasOK[typ]
  if hit == nil then
    hit = false
    for _, name in ipairs(ATLAS[typ] or {}) do
      if C_Texture and C_Texture.GetAtlasInfo and C_Texture.GetAtlasInfo(name) then hit = name; break end
    end
    atlasOK[typ] = hit
  end
  tex:SetTexCoord(0, 1, 0, 1)
  if hit then tex:SetAtlas(hit); tex:SetVertexColor(1, 1, 1, 1); return true end
  tex:SetTexture(MEDIA .. "i_" .. typ); tex:SetVertexColor(1, 1, 1, 1); return false
end

-- ---------------------------------------------------------------- Bauteile
local SLICE
local function Slice(t, m)
  if SLICE == nil then SLICE = t.SetTextureSliceMargins ~= nil end
  if SLICE then pcall(t.SetTextureSliceMargins, t, m, m, m, m); pcall(t.SetTextureSliceMode, t, 0) end
end
local function Grad(t, dir, c1, c2)
  t:SetVertexColor(1, 1, 1, 1)
  if t.SetGradient and CreateColor then
    pcall(t.SetGradient, t, dir, CreateColor(c1[1], c1[2], c1[3], c1[4] or 1), CreateColor(c2[1], c2[2], c2[3], c2[4] or 1))
  else
    t:SetVertexColor(c1[1], c1[2], c1[3], c1[4] or 1)
  end
end
local function A(c, a) return { c[1], c[2], c[3], a } end
local function Tex(p, layer, sub, file, blend)
  local t = p:CreateTexture(nil, layer or "ARTWORK", nil, sub or 0)
  t:SetTexture(file or WHITE)
  if blend then t:SetBlendMode(blend) end
  return t
end
local function MT(p, layer, sub, name, blend) return Tex(p, layer, sub, MEDIA .. name, blend) end
local function Card(p, layer, sub, small, inset, blend)
  local t = MT(p, layer or "BACKGROUND", sub or 0, small and "card_s" or "card", blend)
  local i = inset or 0
  t:SetPoint("TOPLEFT", i, -i); t:SetPoint("BOTTOMRIGHT", -i, i)
  Slice(t, small and 8 or 14)
  return t
end
local function UI(p, size, flags)
  local f = p:CreateFontString(nil, "OVERLAY")
  f:SetFont(FONT, size, flags or "")
  f:SetShadowColor(0, 0, 0, 0.9); f:SetShadowOffset(1, -1)
  f:SetJustifyH("LEFT"); f:SetJustifyV("TOP")
  return f
end
-- Text Buchstabe fuer Buchstabe einfaerben (Verlauf)
local function GradText(txt, c1, c2)
  local chars = {}
  for ch in txt:gmatch("[%z\1-\127\194-\244][\128-\191]*") do chars[#chars + 1] = ch end
  local out = {}
  for i, ch in ipairs(chars) do
    local t = #chars > 1 and (i - 1) / (#chars - 1) or 0
    out[#out + 1] = fmt("|cff%02x%02x%02x%s|r", floor((c1[1] + (c2[1] - c1[1]) * t) * 255),
      floor((c1[2] + (c2[2] - c1[2]) * t) * 255), floor((c1[3] + (c2[3] - c1[3]) * t) * 255), ch)
  end
  return table.concat(out)
end

-- Kapsel mit exakt halbrunden Enden (Leisten, Pillen, Schalter)
local function Cap(p, layer, sub, blend)
  local o = {}
  o.l = MT(p, layer, sub, "white_circle", blend); o.l:SetTexCoord(0, 0.5, 0, 1)
  o.r = MT(p, layer, sub, "white_circle", blend); o.r:SetTexCoord(0.5, 1, 0, 1)
  o.m = Tex(p, layer, sub, WHITE, blend)
  function o:Place(rel, x, y, w, h)
    w = max(w, h)
    local r = h / 2
    self.l:ClearAllPoints(); self.l:SetPoint("TOPLEFT", rel, "TOPLEFT", x, y); self.l:SetSize(r, h)
    self.r:ClearAllPoints(); self.r:SetPoint("TOPLEFT", rel, "TOPLEFT", x + w - r, y); self.r:SetSize(r, h)
    self.m:ClearAllPoints(); self.m:SetPoint("TOPLEFT", rel, "TOPLEFT", x + r, y); self.m:SetSize(max(0.5, w - h), h)
    self.w, self.h = w, h
  end
  function o:Color(c, a) for _, t in ipairs({ self.l, self.r, self.m }) do t:SetVertexColor(c[1], c[2], c[3], a or c[4] or 1) end end
  function o:Gradient(c1, c2)
    self.l:SetVertexColor(c1[1], c1[2], c1[3], c1[4] or 1); self.r:SetVertexColor(c2[1], c2[2], c2[3], c2[4] or 1)
    Grad(self.m, "HORIZONTAL", c1, c2)
  end
  function o:SetShown(v) for _, t in ipairs({ self.l, self.r, self.m }) do t:SetShown(v and true or false) end end
  return o
end

-- Leucht-Kugel: Halo, Verlaufsring, dunkle Glasscheibe, Glanz, Symbol
local function Orb(p, size, lvl)
  local o = {}
  o.halo = MT(p, "BORDER", 6, "dot", "ADD")
  o.ring = MT(p, "ARTWORK", 0, "ctx_ring", "ADD")
  o.disc = MT(p, "ARTWORK", 1, "ctx_disc"); o.disc:SetVertexColor(0.032, 0.042, 0.048, 0.97)
  o.gloss = MT(p, "ARTWORK", 2, "ctx_gloss", "ADD"); o.gloss:SetVertexColor(1, 1, 1, 0.22)
  o.icon = p:CreateTexture(nil, "ARTWORK", nil, 3)
  o.halo:SetAlpha(0.32)
  for _, t in ipairs({ o.halo, o.ring, o.gloss, o.icon }) do t:SetPoint("CENTER", o.disc, "CENTER") end
  function o:SetSize(s)
    self.size = s
    self.halo:SetSize(s * 2.2, s * 2.2); self.ring:SetSize(s * 1.62, s * 1.62)
    self.disc:SetSize(s * 1.49, s * 1.49); self.gloss:SetSize(s * 1.49, s * 1.49)
    local k = self.atlas and 0.80 or 0.56; self.icon:SetSize(s * k, s * k)
  end
  function o:SetPoint(...) self.disc:ClearAllPoints(); self.disc:SetPoint(...) end
  function o:Tint(c, c2)
    if c2 then Grad(self.ring, "VERTICAL", c, c2) else self.ring:SetVertexColor(c[1], c[2], c[3], 1) end
    self.halo:SetVertexColor(c[1], c[2], c[3], 1)
  end
  function o:Icon(typ) self.atlas = SetIcon(self.icon, typ or "note"); self.icon:Show(); self:SetSize(self.size or size) end
  function o:SetShown(v) for _, t in ipairs({ self.halo, self.ring, self.disc, self.gloss, self.icon }) do t:SetShown(v and true or false) end end
  o:SetSize(size)
  return o
end

-- Neon-Glas-Flaeche (Fenster): Aussenleuchten, Verlaufskante, Koerper, Farbschleier, Lichtkante
local function Glass(f)
  local gl = CreateFrame("Frame", nil, f)
  gl:SetPoint("TOPLEFT", -34, 34); gl:SetPoint("BOTTOMRIGHT", 34, -34)
  gl:SetFrameLevel(max(0, f:GetFrameLevel() - 1))
  local g = MT(gl, "BACKGROUND", 0, "glow", "ADD"); g:SetAllPoints(); Slice(g, 60)
  Grad(g, "HORIZONTAL", A(GREEN, 0.26), A(AQUA, 0.20))
  local edge = Card(f, "BACKGROUND", 0, false, 0); Grad(edge, "HORIZONTAL", A(GREEN, 0.80), A(AQUA, 0.55))
  local body = Card(f, "BACKGROUND", 1, false, 1); Grad(body, "VERTICAL", { 0.030, 0.034, 0.048, 0.97 }, { 0.072, 0.094, 0.090, 0.96 })
  local tint = Card(f, "BACKGROUND", 2, false, 1, "ADD"); Grad(tint, "HORIZONTAL", A(GREEN, 0.05), A(AQUA, 0.035))
  local sheen = Tex(f, "BORDER", 4); sheen:SetPoint("TOPLEFT", 14, -1); sheen:SetPoint("TOPRIGHT", -14, -1); sheen:SetHeight(40)
  Grad(sheen, "VERTICAL", { 1, 1, 1, 0 }, { 1, 1, 1, 0.045 })
  local h1, h2 = Tex(f, "BORDER", 5), Tex(f, "BORDER", 5)
  h1:SetPoint("TOPLEFT", f, "TOPLEFT", 14, -1); h1:SetPoint("TOPRIGHT", f, "TOP", 0, -1); h1:SetHeight(1)
  h2:SetPoint("TOPLEFT", f, "TOP", 0, -1); h2:SetPoint("TOPRIGHT", f, "TOPRIGHT", -14, -1); h2:SetHeight(1)
  Grad(h1, "HORIZONTAL", { 1, 1, 1, 0 }, { 1, 1, 1, 0.30 }); Grad(h2, "HORIZONTAL", { 1, 1, 1, 0.30 }, { 1, 1, 1, 0 })
end

-- Tooltip
local function Tip(owner, lines)
  local T = _G.GameTooltip
  if not T or not lines or #lines == 0 then return end
  T:SetOwner(owner, "ANCHOR_RIGHT")
  for i, l in ipairs(lines) do
    if i == 1 then T:AddLine(l, GREEN[1], GREEN[2], GREEN[3]) else T:AddLine(l, 0.92, 0.95, 0.94, true) end
  end
  T:Show()
end
local function TipHide() if _G.GameTooltip then _G.GameTooltip:Hide() end end

-- runder Glas-Knopf (Kopfzeile)
local function RoundButton(p, size, onClick, tip)
  local b = CreateFrame("Button", nil, p)
  b:SetSize(size, size)
  b.ring = MT(b, "ARTWORK", 0, "ctx_ring", "ADD"); b.ring:SetPoint("CENTER"); b.ring:SetSize(size * 1.05, size * 1.05)
  Grad(b.ring, "VERTICAL", A(TEAL, 0.9), A(GREEN, 0.9))
  b.disc = MT(b, "ARTWORK", 1, "ctx_disc"); b.disc:SetPoint("CENTER"); b.disc:SetSize(size * 0.92, size * 0.92)
  b.disc:SetVertexColor(0.04, 0.06, 0.06, 0.96)
  b.gloss = MT(b, "ARTWORK", 2, "ctx_gloss", "ADD"); b.gloss:SetPoint("CENTER"); b.gloss:SetSize(size * 0.92, size * 0.92)
  b.gloss:SetVertexColor(1, 1, 1, 0.18)
  b.hl = MT(b, "HIGHLIGHT", 0, "dot", "ADD"); b.hl:SetPoint("CENTER"); b.hl:SetSize(size * 1.6, size * 1.6)
  b.hl:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.35)
  b:SetScript("OnClick", onClick)
  if tip then
    b:SetScript("OnEnter", function(self) Tip(self, tip) end)
    b:SetScript("OnLeave", TipHide)
  end
  return b
end

-- Schalter (wie LevelPilot): Beschriftung + Kapsel mit Knopf
local function Switch(p, label, get, set, tip)
  local b = CreateFrame("Button", nil, p)
  b:SetSize(112, 30)
  b.txt = UI(b, 11); b.txt:SetJustifyV("MIDDLE"); b.txt:SetPoint("RIGHT", b, "RIGHT", -44, 0)
  b.txt:SetText(label); b.txt:SetTextColor(0.80, 0.86, 0.85)
  b.track = Cap(b, "ARTWORK", 0)
  b.track:Place(b, 112 - 38, -6, 38, 18)
  b.knob = MT(b, "ARTWORK", 2, "white_circle"); b.knob:SetSize(14, 14)
  function b:Update()
    local on = get()
    if on then b.track:Gradient(A(GREEN, 1), A(TEAL, 1)) else b.track:Color({ 0.22, 0.25, 0.27 }, 1) end
    b.knob:ClearAllPoints()
    b.knob:SetPoint("TOPLEFT", b, "TOPLEFT", on and (112 - 18) or (112 - 36), -8)
    b.knob:SetVertexColor(on and 1 or 0.65, on and 1 or 0.68, on and 1 or 0.70, 1)
  end
  b:SetScript("OnClick", function() set(not get()); b:Update() end)
  if tip then
    b:SetScript("OnEnter", function(self) Tip(self, tip) end)
    b:SetScript("OnLeave", TipHide)
  end
  b:Update()
  return b
end

-- ---------------------------------------------------------------- RXP-Daten lesen
local function RXPr() return _G.RXP end
local function RXPF() return _G.RXPFrame end

-- Text wie RXP ihn zeigt, aber mit Element (Quest-Titel deutsch), ohne fuehrende Symbole/Leerzeichen
local function ElText(el)
  local r = RXPr()
  local s = el and el.text
  if type(s) ~= "string" or s == "" or s == " " then return nil end
  if r and r.ReplaceNpcIds then
    local ok, t = pcall(r.ReplaceNpcIds, s, el)
    if ok and type(t) == "string" then s = t end
  end
  s = s:gsub("^%s+", ""):gsub("^>>", ""):gsub("^|T[^|]*|t%s*", ""):gsub("\\n", "\n")
  return s
end
N.ElText = ElText

-- Eigener Questlog-Abgleich: angenommen / abgegeben laut Spiel (dieselben Fragen wie RXP)
local function OnQuest(id)
  if C_QuestLog and C_QuestLog.IsOnQuest then local ok, v = pcall(C_QuestLog.IsOnQuest, id); if ok then return v end end
end
local function TurnedIn(id)
  if C_QuestLog and C_QuestLog.IsQuestFlaggedCompleted then local ok, v = pcall(C_QuestLog.IsQuestFlaggedCompleted, id); if ok then return v end end
end
local function GameDone(el)
  local id = el and tonumber(el.questId)
  if not id then return false end
  if el.tag == "accept" then return (OnQuest(id) or TurnedIn(id)) and true or false end
  if el.tag == "turnin" then return TurnedIn(id) and true or false end
  return false
end
N.GameDone = GameDone

-- Abgeben geht nicht, solange die Quest im Log noch offene Ziele hat (RXP wartet dann einfach weiter).
-- Liefert die offenen Ziele als Text ("Gefuellte geaetzte Phiole: 0/1"), sonst nil.
local HINT = {
  -- aus RXPs eigenem Classic-Guide (RestedXP Horde 20-30): Phiole am Mondbrunnen in Eschental fuellen
  [1195] = "Leere Phiole am Mondbrunnen in Eschental benutzen (RXP-Guide: 60.2, 72.9).",
}
local function Missing(id)
  if not id or not OnQuest(id) or TurnedIn(id) then return nil end
  if not (C_QuestLog and C_QuestLog.GetQuestObjectives) then return nil end
  local ok, objs = pcall(C_QuestLog.GetQuestObjectives, id)
  if not ok or type(objs) ~= "table" then return nil end
  local out = {}
  for _, o in ipairs(objs) do
    if type(o) == "table" and not o.finished then
      local t = o.text
      if type(t) ~= "string" or t == "" then
        t = (o.numFulfilled and o.numRequired) and fmt("%d/%d", o.numFulfilled, o.numRequired) or nil
      end
      if t then out[#out + 1] = t end
    end
  end
  if #out == 0 then return nil end
  return out, HINT[id]
end
N.Missing = Missing

-- Grind-Befehl von RXP (".xp 16" = "Grinde bis Stufe 16"). NICHT gemeint: ".xp <16,1" / ".xp >16,1" – das sind
-- Sprungmarken (Schritt ueberspringen je nach Stufe, ohne Text), die bleiben wie sie sind.
local function IsGrind(el)
  return el and el.tag == "xp" and not el.skipstep and not el.textOnly
end
N.IsGrind = IsGrind
local function GrindOff() return not (N.DB and N.DB.grind) end

-- Hinweis-Texte: RXPs Textur-/Farbcodes raus
local function Plain(s)
  return (tostring(s or ""):gsub("|T[^|]*|t", ""):gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):gsub("^%s+", ""):gsub("%s+$", ""))
end

-- RXP markiert "Annehmen" mit Fehler-Symbol, wenn eine Vorquest fehlt (Tooltip: "Missing pre-requisites:" + Quests).
-- Dann kann RXP nie weiter – sagen, welche Quest fehlt.
local function PreReq(el)
  local r = RXPr()
  if not (r and r.icons and r.icons.error and el.icon == r.icons.error) or type(el.tooltip) ~= "string" then return nil end
  local out = {}
  local first = true
  for line in el.tooltip:gmatch("[^\n]+") do
    if first then first = false
    else
      local id = tonumber(line:match("%((%d+)%)%s*$"))
      local name = (id and N.QuestTitle and N.QuestTitle(id)) or Plain(line:gsub("%s*%(%d+%)%s*$", ""))
      if name and name ~= "" then out[#out + 1] = name end
    end
  end
  return #out > 0 and out or nil
end
N.PreReq = PreReq

local function Progress()
  local r = RXPr()
  local g = r and r.currentGuide
  if not g then return end
  local cur
  if r.GetGuideProgress then local ok, v = pcall(r.GetGuideProgress); if ok then cur = tonumber(v) end end
  cur = cur or tonumber(g.currentStep) or 1
  return g, cur, (g.steps and #g.steps) or 0
end

-- Aktive Schritte: genau die, die RXP gerade oben anzeigt (mit seinen Haken-Knoepfen)
local function ActiveSteps()
  local F = RXPF()
  local out, grind = {}, {}
  local hideGrind = GrindOff()
  local pool = F and F.CurrentStepFrame and F.CurrentStepFrame.framePool
  for _, sf in ipairs(pool or {}) do
    local st = sf.step
    if st and sf:IsShown() and sf:GetAlpha() > 0 and st.active ~= false then
      local lines, best, bestRank, open, total = {}, nil, -1, 0, 0
      local g = { step = st, efs = {}, other = 0 }
      for j, el in ipairs(st.elements or {}) do
        local ef = sf.elements and sf.elements[j]
        local shown = ef and ef:IsShown() and ef:GetAlpha() > 0
        local txt = shown and ElText(el)
        if hideGrind and IsGrind(el) then
          if ef then g.efs[#g.efs + 1] = ef end
          txt = nil
        elseif shown and not el.textOnly and ef.button and ef.button:IsShown() then
          g.other = g.other + 1
        end
        if txt then
          local btn = ef.button
          local hasBox = btn and btn:IsShown() and not el.textOnly
          local rxpDone = (btn and btn.GetChecked and btn:GetChecked()) or el.completed or el.skip
          local gameDone = GameDone(el)
          local done = hasBox and (rxpDone or gameDone) and true or false
          local typ = TypeOf(el)
          local miss, hint, head
          local qid = tonumber(el.questId)
          if el.tag == "turnin" and not done and qid then
            miss, hint = Missing(qid)
            if miss then head = "ABGEBEN GEHT NOCH NICHT"
            elseif not OnQuest(qid) and not TurnedIn(qid) and not el.skipIfMissing then
              -- RXP wartet aufs Abgeben einer Quest, die gar nicht im Log ist -> haengt fuer immer
              head, miss = "QUEST NICHT IM LOG", { "Du hast diese Quest nicht (nie angenommen oder abgebrochen)." }
              hint = "Annehmen, falls noch möglich – sonst mit › überspringen."
            end
          elseif el.tag == "accept" and not done then
            local pre = PreReq(el)
            if pre then head, miss, hint = "VORQUEST FEHLT", pre, "Erst diese Quest(s) abschließen – oder mit › überspringen." end
          end
          lines[#lines + 1] = { text = txt, el = el, ef = ef, box = hasBox, done = done, typ = typ,
            sync = gameDone and not rxpDone and hasBox, miss = miss, hint = hint, head = head }
          if hasBox then total = total + 1; if not done then open = open + 1 end end
          local rk = typ and RANK[typ] or 0
          if not done and rk > bestRank then best, bestRank = typ, rk end
        end
      end
      if #g.efs > 0 then
        -- reiner Grind-Schritt: Hinweis-Zeilen ("Grinde hier bis 16, die naechsten Quests sind schwer") gleich mit weg
        g.pure = g.other == 0
        grind[#grind + 1] = g
        if g.pure then lines = {} end
      end
      if #lines > 0 then
        if not best then for _, l in ipairs(lines) do if l.typ and (RANK[l.typ] or 0) > bestRank then best, bestRank = l.typ, RANK[l.typ] end end end
        out[#out + 1] = { step = st, sf = sf, lines = lines, typ = best or "note", open = open, total = total,
          title = sf.number and sf.number.text and sf.number.text:GetText() }
      end
    end
  end
  return out, grind
end
N.ActiveSteps = ActiveSteps

-- Kommende Schritte (nach dem aktuellen): nur, was RXP auch in der Liste zeigen wuerde
local function NextSteps(cur, n)
  local r = RXPr()
  local g = r and r.currentGuide
  local out = {}
  if not (g and g.steps) then return out end
  local lvl = UnitLevel("player") or 1
  local i = (cur or 1) + 1
  while #out < n and i <= #g.steps do
    local st = g.steps[i]
    if st and not st.active and not st.hidewindow and not st.optional and not st.completed
      and (tonumber(st.level) or 0) <= lvl then
      local first, typ, rk, all = nil, nil, -1, {}
      local hasGrind, other = false, false
      local hideGrind = GrindOff()
      for _, el in ipairs(st.elements or {}) do
        local t = ElText(el)
        if hideGrind and IsGrind(el) then hasGrind, t = true, nil
        elseif not el.textOnly then other = true end
        if t then
          all[#all + 1] = t
          local ty = TypeOf(el)
          if ty and (RANK[ty] or 0) > rk then typ, rk = ty, RANK[ty]; first = first or t end
          if not first and not el.textOnly then first = t end
        end
      end
      first = first or all[1]
      if hasGrind and not other then first = nil end
      if first then out[#out + 1] = { index = i, text = first, typ = typ or "note", all = all, step = st } end
    end
    i = i + 1
  end
  return out
end
N.NextSteps = NextSteps

-- ---------------------------------------------------------------- Fenster
local win, built
local CARDS, ROWS = {}, {}
local XP = {}

local function DB() return N.DB end

local function SavePos()
  if not win then return end
  local p, _, rp, x, y = win:GetPoint(1)
  DB().pos = { p or "TOPLEFT", rp or "TOPLEFT", x or 0, y or 0 }
end

-- Groesse: an der Ecke unten rechts ziehen. Die linke obere Ecke bleibt stehen, Skala 0.6 – 1.6.
local SMIN, SMAX = 0.6, 1.6
local function ScaleBy(cx, drag)
  local ui = UIParent:GetEffectiveScale() or 1
  local eff = (cx - drag.left + drag.grab) / W
  local s = min(SMAX, max(SMIN, eff / ui))
  s = floor(s * 100 + 0.5) / 100
  local e = s * ui
  win:SetScale(s)
  win:ClearAllPoints()
  win:SetPoint("TOPLEFT", UIParent, "BOTTOMLEFT", drag.left / e, drag.top / e)
  DB().scale = s
  return s
end
N.ScaleBy = ScaleBy

local function MakeGrip()
  local gp = CreateFrame("Button", nil, win)
  gp:SetSize(26, 26)
  gp:SetPoint("BOTTOMRIGHT", win, "BOTTOMRIGHT", -4, 4)
  gp:SetFrameLevel(win:GetFrameLevel() + 20)
  gp.halo = MT(gp, "BACKGROUND", 0, "dot", "ADD"); gp.halo:SetPoint("CENTER", 2, -2); gp.halo:SetSize(44, 44)
  gp.halo:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.10)
  -- drei Neon-Punkte entlang der Ecke (Verlauf Gruen -> Tuerkis)
  gp.dots = {}
  local spots = { { 18, 6, 4.5, GREEN }, { 12, 12, 4, { 0.20, 0.95, 0.66 } }, { 6, 18, 3.5, TEAL },
    { 18, 12, 3.5, { 0.20, 0.95, 0.66 } }, { 12, 18, 3, TEAL }, { 18, 18, 3, TEAL } }
  for i, d in ipairs(spots) do
    local t = MT(gp, "ARTWORK", 1, "white_circle"); t:SetSize(d[3], d[3])
    t:SetPoint("CENTER", gp, "TOPLEFT", d[1] + 1, -d[2] - 1)
    t:SetVertexColor(d[4][1], d[4][2], d[4][3], 0.85)
    gp.dots[i] = t
  end
  gp.hl = MT(gp, "HIGHLIGHT", 0, "dot", "ADD"); gp.hl:SetPoint("CENTER", 2, -2); gp.hl:SetSize(52, 52)
  gp.hl:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.35)
  gp:SetScript("OnEnter", function(self) Tip(self, { "Größe ändern", "Ziehen = Fenster größer oder kleiner. Rechtsklick = normale Größe." }) end)
  gp:SetScript("OnLeave", TipHide)
  gp:RegisterForClicks("RightButtonUp")
  gp:SetScript("OnClick", function()
    local e0 = win:GetEffectiveScale()
    local drag = { left = (win:GetLeft() or 0) * e0, top = (win:GetTop() or 0) * e0, grab = 0 }
    ScaleBy(drag.left + W * (UIParent:GetEffectiveScale() or 1), drag)
    SavePos(); N.Fenster.Refresh()
  end)
  gp:SetScript("OnMouseDown", function(self, button)
    if button ~= "LeftButton" or (DB() and DB().fest) then return end
    local e0 = win:GetEffectiveScale()
    local cx = GetCursorPosition()
    local left, top = (win:GetLeft() or 0) * e0, (win:GetTop() or 0) * e0
    self.drag = { left = left, top = top, grab = left + W * e0 - cx }
    for _, t in ipairs(self.dots) do t:SetAlpha(1) end
    self:SetScript("OnUpdate", function(me)
      local x = GetCursorPosition()
      if me.drag and x then ScaleBy(x, me.drag) end
    end)
  end)
  gp:SetScript("OnMouseUp", function(self)
    if not self.drag then return end
    self:SetScript("OnUpdate", nil)
    self.drag = nil
    SavePos()
    N.Fenster.Refresh()
  end)
  return gp
end

local function MenuRXP()
  local F = RXPF()
  if F and F.DropDownMenu then pcall(F.DropDownMenu) end
end

local function Build()
  if built then return end
  built = true
  win = CreateFrame("Frame", "RXPNeonFenster", UIParent)
  win:SetSize(W, 420)
  win:SetFrameStrata("LOW")
  win:SetClampedToScreen(true)
  win:SetMovable(true)
  win:EnableMouse(true)
  win:RegisterForDrag("LeftButton")
  win:SetScript("OnDragStart", function(self) if not (DB() and DB().fest) then self:StartMoving() end end)
  win:SetScript("OnDragStop", function(self) self:StopMovingOrSizing(); SavePos() end)
  local pos = DB().pos
  if pos then win:SetPoint(pos[1], UIParent, pos[2], pos[3], pos[4]) else win:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 24, -190) end
  Glass(win)

  -- Kopf: Stufen-Kugel, Gebiet (Verlauf), Unterzeile, Knoepfe
  win.orb = Orb(win, 30)
  win.orb:SetPoint("CENTER", win, "TOPLEFT", PAD + 26, -PAD - 26)
  win.orb:Tint(GREEN, TEAL); win.orb.icon:Hide()
  win.orb.halo:SetAlpha(0.45)
  win.lvl = UI(win, 19, ""); win.lvl:SetJustifyH("CENTER"); win.lvl:SetJustifyV("MIDDLE")
  win.lvl:SetPoint("CENTER", win.orb.disc, "CENTER", 0, 0)
  win.title = UI(win, 18); win.title:SetPoint("TOPLEFT", win, "TOPLEFT", PAD + 62, -PAD - 6)
  win.title:SetWidth(IW - 62 - 80); win.title:SetWordWrap(false)
  win.sub = UI(win, 11); win.sub:SetPoint("TOPLEFT", win.title, "BOTTOMLEFT", 0, -5)
  win.sub:SetWidth(IW - 62 - 80); win.sub:SetWordWrap(false); win.sub:SetTextColor(0.62, 0.78, 0.74)
  win.menu = RoundButton(win, 32, MenuRXP, { "Guides & RXP-Menü", "Anderen Guide wählen, Optionen von RestedXP." })
  win.menu:SetPoint("TOPRIGHT", win, "TOPRIGHT", -PAD, -PAD - 10)
  win.menu.dots = UI(win.menu, 16, ""); win.menu.dots:SetJustifyH("CENTER"); win.menu.dots:SetJustifyV("MIDDLE")
  win.menu.dots:SetPoint("CENTER", win.menu, "CENTER", 0, 3); win.menu.dots:SetText("•••")
  win.arrowBtn = RoundButton(win, 32, function()
    local r = RXPr(); local p = r and r.settings and r.settings.profile
    if p then p.disableArrow = not p.disableArrow; if r.arrowFrame and p.disableArrow then r.arrowFrame:Hide() end
      if r.UpdateMap then pcall(r.UpdateMap) end end
    N.Fenster.Refresh()
  end, { "Pfeil an/aus", "Neon-Pfeil zum nächsten Ziel ein- oder ausblenden." })
  win.arrowBtn:SetPoint("RIGHT", win.menu, "LEFT", -8, 0)
  win.arrowBtn.icon = MT(win.arrowBtn, "ARTWORK", 3, "i_arrow"); win.arrowBtn.icon:SetPoint("CENTER"); win.arrowBtn.icon:SetSize(16, 16)

  -- EP-Leiste
  XP.left = UI(win, 12); XP.right = UI(win, 12); XP.right:SetJustifyH("RIGHT")
  XP.track = Cap(win, "ARTWORK", 0); XP.rest = Cap(win, "ARTWORK", 1); XP.fill = Cap(win, "ARTWORK", 2)
  XP.knob = MT(win, "ARTWORK", 4, "dot", "ADD"); XP.knob:SetSize(22, 22)
  XP.dot = MT(win, "ARTWORK", 5, "white_circle"); XP.dot:SetSize(9, 9)
  -- Guide-Fortschritt
  win.flag = MT(win, "ARTWORK", 3, "i_flag"); win.flag:SetSize(13, 13); win.flag:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 1)
  win.prog = UI(win, 12); win.progR = UI(win, 12); win.progR:SetJustifyH("RIGHT")
  win.pTrack = Cap(win, "ARTWORK", 0); win.pFill = Cap(win, "ARTWORK", 1)
  -- Ueberschrift Liste
  win.nextLbl = UI(win, 10); win.nextLbl:SetTextColor(0.55, 0.66, 0.64)
  -- Leer-Zustand
  win.empty = UI(win, 13); win.empty:SetWidth(IW - 20); win.empty:SetJustifyH("CENTER")
  win.empty:SetTextColor(0.75, 0.82, 0.80)

  -- Fuss: GUIDE WAEHLEN + Schalter
  win.guideBtn = CreateFrame("Button", nil, win)
  win.guideBtn:SetSize(132, 30)
  win.guideBtn.cap = Cap(win.guideBtn, "ARTWORK", 0); win.guideBtn.cap:Place(win.guideBtn, 0, 0, 132, 30)
  win.guideBtn.cap:Gradient(A(GREEN, 1), A(TEAL, 1))
  win.guideBtn.hl = Card(win.guideBtn, "HIGHLIGHT", 0, true, 0); win.guideBtn.hl:SetVertexColor(1, 1, 1, 0.20)
  win.guideBtn.txt = UI(win.guideBtn, 12, ""); win.guideBtn.txt:SetJustifyH("CENTER"); win.guideBtn.txt:SetJustifyV("MIDDLE")
  win.guideBtn.txt:SetPoint("CENTER", 0, 0); win.guideBtn.txt:SetText("GUIDE WÄHLEN")
  win.guideBtn.txt:SetTextColor(0.02, 0.07, 0.05); win.guideBtn.txt:SetShadowOffset(0, 0)
  win.guideBtn:SetScript("OnClick", MenuRXP)
  win.grip = MakeGrip()
  win.swDe = Switch(win, "DEUTSCH", function() return DB().deutsch end, function(v)
    DB().deutsch = v and true or false; N.ClearCache(); if N.Apply then N.Apply() end
  end, { "Deutsche Texte", "Schritt-Texte, Namen und Quest-Titel auf Deutsch." })

  -- Tick: Aenderungen sammeln, hoechstens 10x pro Sekunde neu aufbauen; Questlog-Abgleich 2x pro Sekunde
  local acc, sig = 0, nil
  win:SetScript("OnUpdate", function(_, dt)
    acc = acc + (dt or 0)
    if win.dirty and acc > 0.1 then acc = 0; N.Fenster.Refresh(); return end
    if acc > 0.5 then
      acc = 0
      local s = N.Fenster.Signature()
      if s ~= sig then sig = s; N.Fenster.Refresh() end
    end
  end)
end

-- Signatur der sichtbaren Lage (billig): Schritt, Haken, Texte der aktiven Elemente, Stufe/EP
function N.Fenster_Signature()
  local g, cur = Progress()
  local parts = { g and g.name or "-", cur or 0, UnitLevel("player") or 0, UnitXP and UnitXP("player") or 0 }
  local F = RXPF()
  for _, sf in ipairs(F and F.CurrentStepFrame and F.CurrentStepFrame.framePool or {}) do
    if sf:IsShown() and sf.step then
      parts[#parts + 1] = sf.step.index or "?"
      for _, ef in ipairs(sf.elements or {}) do
        if ef:IsShown() and ef:GetAlpha() > 0 then
          parts[#parts + 1] = (ef.button and ef.button.GetChecked and ef.button:GetChecked()) and "1" or "0"
          parts[#parts + 1] = ef.text and ef.text:GetText() or ""
        end
      end
    end
  end
  return table.concat(parts, "\031")
end

-- ---------------------------------------------------------------- Karten (aktive Schritte)
local function GetCard(i)
  local c = CARDS[i]
  if c then return c end
  c = CreateFrame("Frame", nil, win)
  c.glow = MT(c, "BACKGROUND", 0, "glow", "ADD"); c.glow:SetPoint("TOPLEFT", -14, 14); c.glow:SetPoint("BOTTOMRIGHT", 14, -14); Slice(c.glow, 60)
  c.rim = Card(c, "BACKGROUND", 1, false, 0)
  c.body = Card(c, "BACKGROUND", 2, false, 1)
  c.orb = Orb(c, 20)
  c.kind = UI(c, 11, "")
  c.step = UI(c, 11); c.step:SetTextColor(0.62, 0.70, 0.70)
  c.dist = UI(c, 15, ""); c.dist:SetJustifyH("RIGHT")
  c.lines = {}
  -- Warnung: Abgeben geht noch nicht (Quest-Ziele offen)
  c.warn = CreateFrame("Frame", nil, c)
  c.warn.bg = Card(c.warn, "ARTWORK", 0, true, 0); c.warn.bg:SetVertexColor(1.0, 0.55, 0.20, 0.13)
  c.warn.bar = Tex(c.warn, "ARTWORK", 1); c.warn.bar:SetWidth(3)
  c.warn.bar:SetPoint("TOPLEFT", 0, -6); c.warn.bar:SetPoint("BOTTOMLEFT", 0, 6); c.warn.bar:SetVertexColor(1.0, 0.62, 0.28, 0.9)
  c.warn.head = UI(c.warn, 11, ""); c.warn.head:SetPoint("TOPLEFT", 12, -7); c.warn.head:SetTextColor(1.0, 0.68, 0.32)
  c.warn.head:SetText("ABGEBEN GEHT NOCH NICHT")
  c.warn.txt = UI(c.warn, 12); c.warn.txt:SetPoint("TOPLEFT", c.warn.head, "BOTTOMLEFT", 0, -4)
  c.warn.txt:SetTextColor(0.94, 0.90, 0.84); c.warn.txt:SetSpacing(2)
  -- Knopf "weiter": Schritt ueberspringen (RXP "Gehe zu Schritt")
  c.skip = CreateFrame("Button", nil, c)
  c.skip:SetSize(26, 26)
  c.skip.cap = Cap(c.skip, "ARTWORK", 0); c.skip.cap:Place(c.skip, 0, 0, 26, 26); c.skip.cap:Color({ 1, 1, 1 }, 0.07)
  c.skip.txt = UI(c.skip, 16, ""); c.skip.txt:SetJustifyH("CENTER"); c.skip.txt:SetJustifyV("MIDDLE")
  c.skip.txt:SetPoint("CENTER", 1, 1); c.skip.txt:SetText("›"); c.skip.txt:SetTextColor(0.75, 0.85, 0.82)
  c.skip.hl = MT(c.skip, "HIGHLIGHT", 0, "dot", "ADD"); c.skip.hl:SetAllPoints(); c.skip.hl:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.35)
  c.skip:SetScript("OnEnter", function(self) Tip(self, { "Schritt überspringen", "Springt zum nächsten Schritt im Guide (wie RXP „Gehe zu Schritt“)." }) end)
  c.skip:SetScript("OnLeave", TipHide)
  c.skip:SetScript("OnClick", function(self)
    local r = RXPr(); local st = self.stepIndex
    if r and r.SetStep and st and not InCombatLockdown() then pcall(r.SetStep, st + 1); N.Fenster.Dirty() end
  end)
  -- Hinweis "alles erledigt -> weiter"
  c.done = CreateFrame("Button", nil, c)
  c.done:SetSize(150, 26)
  c.done.cap = Cap(c.done, "ARTWORK", 0); c.done.cap:Place(c.done, 0, 0, 150, 26); c.done.cap:Gradient(A(GREEN, 1), A(TEAL, 1))
  c.done.txt = UI(c.done, 11, ""); c.done.txt:SetJustifyH("CENTER"); c.done.txt:SetJustifyV("MIDDLE"); c.done.txt:SetPoint("CENTER", 0, 0)
  c.done.txt:SetText("ERLEDIGT · WEITER  ›"); c.done.txt:SetTextColor(0.02, 0.07, 0.05); c.done.txt:SetShadowOffset(0, 0)
  c.done:SetScript("OnClick", function(self) local s = c.skip:GetScript("OnClick"); if s then s(c.skip) end end)
  CARDS[i] = c
  return c
end

local function GetLine(c, j)
  local l = c.lines[j]
  if l then return l end
  l = CreateFrame("Button", nil, c)
  l.ring = MT(l, "ARTWORK", 1, "rxp-btn-blank-32"); l.ring:SetSize(16, 16); l.ring:SetPoint("TOPLEFT", l, "TOPLEFT", 0, 0)
  l.bullet = MT(l, "ARTWORK", 1, "white_circle"); l.bullet:SetSize(6, 6); l.bullet:SetPoint("TOPLEFT", l, "TOPLEFT", 5, -6)
  l.txt = UI(l, 13); l.txt:SetPoint("TOPLEFT", l, "TOPLEFT", 24, -1)
  l.hl = Card(l, "HIGHLIGHT", 0, true, -3); l.hl:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.10)
  l:SetScript("OnClick", function(self)
    local ef = self.ef
    if ef and ef.button and ef.button.Click and self.box then ef.button:Click(); N.Fenster.Dirty() end
  end)
  l:SetScript("OnEnter", function(self)
    if self.box then Tip(self, { self.isDone and "Haken entfernen" or "Als erledigt markieren", "Klick setzt den Haken auch bei RestedXP." }) end
  end)
  l:SetScript("OnLeave", TipHide)
  c.lines[j] = l
  return l
end

-- Entfernung zum Pfeil-Ziel (Yards; im deutschen Spiel als Meter angezeigt)
local function ArrowDist(step)
  local r = RXPr(); local af = r and r.arrowFrame
  if not (af and af:IsShown() and af.element and af.element.step == step) then return nil end
  local d = tonumber(af.distance)
  if d and d >= 0 then return d end
end

local function LayoutCard(c, a, hero, y)
  local allDone = a.total > 0 and a.open == 0
  local T = TYPE[a.typ] or TYPE.note
  if allDone then T = { c = GREEN, de = "ALLES ERLEDIGT" } end
  local col = T.c
  c:ClearAllPoints(); c:SetPoint("TOPLEFT", win, "TOPLEFT", PAD, y); c:SetWidth(IW)
  -- Flaeche: Hero = farbiges Glas mit Leuchten, sonst ruhig
  Grad(c.rim, "HORIZONTAL", A(col, hero and 0.75 or 0.35), A(TEAL, hero and 0.45 or 0.18))
  if hero then
    Grad(c.body, "VERTICAL", { 0.045, 0.075, 0.068, 0.97 }, { 0.10, 0.17, 0.14, 0.95 })
    Grad(c.glow, "HORIZONTAL", A(col, 0.18), A(TEAL, 0.10)); c.glow:Show()
  else
    Grad(c.body, "VERTICAL", { 0.040, 0.050, 0.060, 0.95 }, { 0.070, 0.085, 0.095, 0.95 }); c.glow:Hide()
  end
  local ox = hero and 66 or 44
  local osz = hero and 20 or 13
  c.orb:SetSize(osz); c.orb:Icon(allDone and "complete" or a.typ); c.orb:Tint(col, A(TEAL, 1)); c.orb:SetShown(true)
  c.orb.halo:SetAlpha(hero and 0.40 or 0.15)
  c.orb:SetPoint("CENTER", c, "TOPLEFT", hero and 34 or 23, hero and -36 or -22)
  -- Kopfzeile der Karte
  c.kind:ClearAllPoints(); c.kind:SetPoint("TOPLEFT", c, "TOPLEFT", ox, -12)
  c.kind:SetText(hero and T.de or ("AUCH AKTIV · " .. T.de))
  c.kind:SetTextColor(col[1], col[2], col[3])
  c.step:ClearAllPoints(); c.step:SetPoint("LEFT", c.kind, "RIGHT", 6, 0)
  local idx = a.step and a.step.index
  c.step:SetText(idx and ("·  SCHRITT " .. idx) or "")
  local d = hero and ArrowDist(a.step)
  c.dist:ClearAllPoints(); c.dist:SetPoint("TOPRIGHT", c, "TOPRIGHT", hero and -44 or -14, -10)
  c.dist:SetText(d and fmt("%d |cff8fa7a2m|r", d) or "")
  -- Zeilen
  local ly = hero and -34 or -30
  local tw = IW - ox - 16
  for j, ln in ipairs(a.lines) do
    local l = GetLine(c, j)
    l.ef, l.box, l.isDone = ln.ef, ln.box, ln.done
    l:ClearAllPoints(); l:SetPoint("TOPLEFT", c, "TOPLEFT", ox, ly)
    l.txt:SetWidth(tw - 24)
    l.txt:SetFont(FONT, hero and 13 or 12, "")
    l.txt:SetText(ln.text)
    if ln.done then l.txt:SetTextColor(0.52, 0.60, 0.58)
    elseif ln.miss then l.txt:SetTextColor(1.0, 0.74, 0.45)
    else l.txt:SetTextColor(0.94, 0.97, 0.96) end
    l.ring:SetShown(ln.box); l.bullet:SetShown(not ln.box)
    l.ring:SetTexture(MEDIA .. (ln.done and "rxp-checked-32" or "rxp-btn-blank-32"))
    l.ring:SetVertexColor(1, 1, 1, ln.done and 0.75 or 1)
    l.bullet:SetVertexColor(col[1], col[2], col[3], 0.8)
    local h = max(16, (l.txt:GetStringHeight() or 14) + 2)
    l:SetSize(tw, h); l:Show()
    ly = ly - h - 6
  end
  for j = #a.lines + 1, #c.lines do c.lines[j]:Hide() end
  -- offene Quest-Ziele vor dem Abgeben: klar sagen, warum der Schritt wartet
  local warn, head, abgeben = {}, nil, false
  for _, ln in ipairs(a.lines) do
    if ln.miss then
      head = head or ln.head
      if ln.head == "ABGEBEN GEHT NOCH NICHT" then abgeben = true end
      for _, m in ipairs(ln.miss) do warn[#warn + 1] = "|cffffd27a• " .. m .. "|r" end
      if ln.hint then warn[#warn + 1] = ln.hint end
    end
  end
  if hero and #warn > 0 then
    if abgeben then warn[#warn + 1] = "|cff9fb0aaErst erledigen, dann hier abgeben – RXP geht dann selbst weiter. Oder mit › überspringen.|r" end
    c.warn.head:SetText(head or "ACHTUNG")
    c.warn.txt:SetWidth(tw - 16)
    c.warn.txt:SetText(table.concat(warn, "\n"))
    local wh = 7 + 12 + 4 + (c.warn.txt:GetStringHeight() or 14) + 9
    c.warn:ClearAllPoints(); c.warn:SetPoint("TOPLEFT", c, "TOPLEFT", ox, ly - 2); c.warn:SetSize(tw, wh); c.warn:Show()
    ly = ly - wh - 8
  else
    c.warn:Hide()
  end
  -- Fuss der Karte: alles erledigt -> grosser WEITER-Knopf, sonst kleiner Ueberspringen-Pfeil
  c.skip.stepIndex = idx
  if hero and allDone then
    c.done:ClearAllPoints(); c.done:SetPoint("TOPRIGHT", c, "TOPLEFT", IW - 12, ly - 2); c.done:Show()
    ly = ly - 32
    c.skip:Hide()
  else
    c.done:Hide()
    c.skip:ClearAllPoints(); c.skip:SetPoint("TOPRIGHT", c, "TOPRIGHT", -10, -6); c.skip:SetShown(hero and idx ~= nil)
  end
  local h = max(hero and 74 or 46, -ly + 8)
  c:SetHeight(h)
  c:Show()
  return h
end

-- ---------------------------------------------------------------- Liste (als naechstes)
local function GetRow(i)
  local r = ROWS[i]
  if r then return r end
  r = CreateFrame("Button", nil, win)
  r:SetSize(IW, 34)
  r.body = Card(r, "BACKGROUND", 1, true, 0); r.body:SetVertexColor(1, 1, 1, 0.045)
  r.hl = Card(r, "HIGHLIGHT", 0, true, 0); Grad(r.hl, "HORIZONTAL", A(GREEN, 0.14), A(TEAL, 0.05))
  r.orb = Orb(r, 11); r.orb:SetPoint("CENTER", r, "LEFT", 19, 0); r.orb.halo:SetAlpha(0.12)
  r.txt = UI(r, 13); r.txt:SetJustifyV("MIDDLE"); r.txt:SetPoint("LEFT", r, "LEFT", 40, 0)
  r.txt:SetWidth(IW - 40 - 46); r.txt:SetWordWrap(false); r.txt:SetHeight(18)
  r.num = UI(r, 11); r.num:SetJustifyH("RIGHT"); r.num:SetJustifyV("MIDDLE"); r.num:SetPoint("RIGHT", r, "RIGHT", -12, 0)
  r.num:SetTextColor(0.50, 0.60, 0.58)
  r:SetScript("OnEnter", function(self) if self.tip then Tip(self, self.tip) end end)
  r:SetScript("OnLeave", TipHide)
  ROWS[i] = r
  return r
end

-- ---------------------------------------------------------------- Aufbau
N.Fenster = {}

-- Grind-Befehle ueberspringen (Tiry will nicht grinden): Haken bei RXP setzen wie ein Klick des Spielers.
-- Reiner Grind-Schritt, der danach immer noch der aktuelle ist (z. B. optionaler Schritt): einen Schritt weiter.
function N.Fenster.SkipGrind(list, cur)
  local r = RXPr()
  for _, g in ipairs(list or {}) do
    local st = g.step
    local first = false
    for _, ef in ipairs(g.efs) do
      local el, btn = ef.element, ef.button
      if el and btn and btn.Click and not el.rxnGrind and not el.completed and not el.skip
        and not (btn.GetChecked and btn:GetChecked()) then
        el.rxnGrind = true
        first = true
        pcall(btn.Click, btn)
      elseif el and el.rxnGrind and g.pure and st.active and st.index == cur and not st.rxnGrindJump
        and r and r.SetStep then
        st.rxnGrindJump = true
        pcall(r.SetStep, cur + 1)
      end
    end
    if first then
      local lv = g.efs[1].element and g.efs[1].element.level
      N.P((lv and ("Grind-Schritt (Stufe %d) übersprungen"):format(lv) or "Grind-Schritt übersprungen")
        .. " – |cff8fa7a2/rxn grind an|r zeigt sie wieder.")
    end
  end
end

N.Fenster.Signature = N.Fenster_Signature
function N.Fenster.Dirty() if win then win.dirty = true end end

local function Short(n)
  if n >= 1e6 then return fmt("%.1fM", n / 1e6) end
  if n >= 1e4 then return fmt("%.1fk", n / 1e3) end
  return tostring(floor(n + 0.5))
end

local function GuideTitle(g)
  local name = g and (g.name or g.displayname) or ""
  name = N.T and N.T(name) or name
  local a, b, rest = name:match("^(%d+)%-(%d+)%s+(.+)$")
  local F = RXPF()
  local sub = F and F.GuideName and F.GuideName.text and F.GuideName.text:GetText()
  sub = sub and sub:match("\n(.+)$")
  sub = sub and sub:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):gsub("%s*[Gg]uide%s*", " "):gsub("^%s+", ""):gsub("%s+$", "")
  local parts = {}
  if a then parts[#parts + 1] = "STUFE " .. a .. "–" .. b end
  if sub and sub ~= "" then parts[#parts + 1] = sub:upper() end
  return rest or name, table.concat(parts, "  ·  ")
end

function N.Fenster.Refresh()
  if not (win and DB()) then return end
  win.dirty = false
  local y = -PAD
  local lvl = UnitLevel("player") or 1
  local g, cur, total = Progress()

  -- Kopf
  win.lvl:SetText(tostring(lvl))
  local t, sub = GuideTitle(g)
  win.title:SetText(GradText(g and t or "RestedXP Neon", GREEN, TEAL))
  win.sub:SetText(g and sub or "KEIN GUIDE GELADEN")
  local r = RXPr(); local prof = r and r.settings and r.settings.profile
  local arrowOn = not (prof and prof.disableArrow)
  win.arrowBtn.icon:SetVertexColor(arrowOn and GREEN[1] or 0.45, arrowOn and GREEN[2] or 0.5, arrowOn and GREEN[3] or 0.5, 1)
  y = y - 52 - 14

  -- EP-Leiste
  local xp, xpMax = UnitXP and UnitXP("player") or 0, UnitXPMax and UnitXPMax("player") or 0
  local rest = GetXPExhaustion and GetXPExhaustion() or 0
  local maxed = xpMax <= 0
  for _, o in ipairs({ XP.track, XP.rest, XP.fill }) do o:SetShown(not maxed) end
  XP.left:SetShown(not maxed); XP.right:SetShown(not maxed); XP.knob:SetShown(not maxed); XP.dot:SetShown(not maxed)
  if not maxed then
    local pct = min(1, xp / xpMax)
    XP.left:ClearAllPoints(); XP.left:SetPoint("TOPLEFT", win, "TOPLEFT", PAD, y)
    XP.left:SetText(fmt("%s |cff8fa7a2/ %s EP|r", Short(xp), Short(xpMax)))
    XP.right:ClearAllPoints(); XP.right:SetPoint("TOPRIGHT", win, "TOPRIGHT", -PAD, y)
    XP.right:SetText(fmt("%.0f %%%s", pct * 100, rest > 0 and fmt("   |cff4d9effErholt %.0f %%|r", min(150, rest / xpMax * 100)) or ""))
    local by = y - 18
    XP.track:Place(win, PAD, by, IW, 8); XP.track:Color({ 1, 1, 1 }, 0.07)
    local fw = max(8, IW * pct)
    XP.fill:Place(win, PAD, by, fw, 8); XP.fill:Gradient(A(TEAL, 1), A(GREEN, 1))
    local rw = min(IW, IW * min(1, (xp + rest) / xpMax))
    XP.rest:SetShown(rest > 0)
    XP.rest:Place(win, PAD, by, max(8, rw), 8); XP.rest:Color(AQUA, 0.45)
    XP.knob:ClearAllPoints(); XP.knob:SetPoint("CENTER", win, "TOPLEFT", PAD + fw - 4, by - 4)
    XP.knob:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.8)
    XP.dot:ClearAllPoints(); XP.dot:SetPoint("CENTER", win, "TOPLEFT", PAD + fw - 4, by - 4)
    y = by - 8 - 12
  end

  -- Guide-Fortschritt
  local hasG = g and total > 0
  win.flag:SetShown(hasG); win.prog:SetShown(hasG); win.progR:SetShown(hasG)
  win.pTrack:SetShown(hasG); win.pFill:SetShown(hasG)
  if hasG then
    win.flag:ClearAllPoints(); win.flag:SetPoint("TOPLEFT", win, "TOPLEFT", PAD, y)
    win.prog:ClearAllPoints(); win.prog:SetPoint("TOPLEFT", win, "TOPLEFT", PAD + 19, y)
    win.prog:SetText(fmt("SCHRITT |cffffffff%d|r |cff8fa7a2/ %d|r", cur, total)); win.prog:SetTextColor(0.55, 0.70, 0.66)
    win.progR:ClearAllPoints(); win.progR:SetPoint("TOPRIGHT", win, "TOPRIGHT", -PAD, y)
    win.progR:SetText(fmt("%d %%", floor(min(1, cur / total) * 100 + 0.5))); win.progR:SetTextColor(0.80, 0.88, 0.86)
    local by = y - 18
    win.pTrack:Place(win, PAD, by, IW, 5); win.pTrack:Color({ 1, 1, 1 }, 0.07)
    win.pFill:Place(win, PAD, by, max(5, IW * min(1, cur / total)), 5); win.pFill:Gradient(A(GREEN, 0.9), A(TEAL, 0.9))
    y = by - 5 - 14
  end

  -- Guide-Tipp (falscher / kein Guide fuer die Stufe)
  local tipp = N.TippButton and N.TippButton()
  if tipp and tipp:IsShown() then
    tipp:ClearAllPoints(); tipp:SetPoint("TOPLEFT", win, "TOPLEFT", PAD, y)
    y = y - tipp:GetHeight() - 10
  end

  -- JETZT: aktive Schritte (der aktuelle zuerst)
  local act, grind = {}, {}
  if g then act, grind = ActiveSteps() end
  if GrindOff() and not InCombatLockdown() then N.Fenster.SkipGrind(grind, cur) end
  table.sort(act, function(a, b)
    local ac, bc = a.step.index == cur, b.step.index == cur
    if ac ~= bc then return ac end
    return (a.step.index or 0) < (b.step.index or 0)
  end)
  local nCards = min(#act, 4)
  for i = 1, nCards do
    local a = act[i]
    -- Spiel sagt "schon erledigt", RXP noch nicht: Haken bei RXP setzen (wie ein Klick des Spielers)
    if DB().abgleich then
      for _, ln in ipairs(a.lines) do
        if ln.sync and ln.ef and ln.ef.button and ln.ef.button.Click and not ln.el.rxnSynced and not InCombatLockdown() then
          ln.el.rxnSynced = true
          pcall(ln.ef.button.Click, ln.ef.button)
        end
      end
    end
    local h = LayoutCard(GetCard(i), a, i == 1, y)
    y = y - h - 8
  end
  for i = nCards + 1, #CARDS do CARDS[i]:Hide() end
  -- Leer-Zustand
  win.empty:SetShown(nCards == 0)
  if nCards == 0 then
    win.empty:ClearAllPoints(); win.empty:SetPoint("TOPLEFT", win, "TOPLEFT", PAD + 10, y - 6)
    win.empty:SetText(g and "Dieser Schritt ist für deine Stufe noch gesperrt\noder der Guide ist zu Ende." or
      "Kein Guide geladen.\nUnten auf |cff39ff6bGUIDE WÄHLEN|r klicken.")
    y = y - (win.empty:GetStringHeight() or 30) - 18
  end

  -- ALS NAECHSTES
  local nx = g and NextSteps(cur, DB().zeilen or 4) or {}
  win.nextLbl:SetShown(#nx > 0)
  if #nx > 0 then
    win.nextLbl:ClearAllPoints(); win.nextLbl:SetPoint("TOPLEFT", win, "TOPLEFT", PAD + 4, y - 2)
    win.nextLbl:SetText("ALS NÄCHSTES")
    y = y - 18
  end
  for i, s in ipairs(nx) do
    local row = GetRow(i)
    local T = TYPE[s.typ] or TYPE.note
    row:ClearAllPoints(); row:SetPoint("TOPLEFT", win, "TOPLEFT", PAD, y)
    row.orb:Icon(s.typ); row.orb:Tint(T.c, A(TEAL, 1))
    row.txt:SetText(s.text:gsub("\n.*", ""))
    row.num:SetText("#" .. s.index)
    local tip = { T.de .. "  ·  Schritt " .. s.index }
    for _, l in ipairs(s.all) do tip[#tip + 1] = l end
    row.tip = tip
    row:SetAlpha(1 - (i - 1) * 0.12)
    row:Show()
    y = y - 34 - 6
  end
  for i = #nx + 1, #ROWS do ROWS[i]:Hide() end

  -- Fuss
  y = y - 6
  win.guideBtn:ClearAllPoints(); win.guideBtn:SetPoint("TOPLEFT", win, "TOPLEFT", PAD, y)
  win.swDe:ClearAllPoints(); win.swDe:SetPoint("TOPRIGHT", win, "TOPRIGHT", -PAD - 18, y) -- Platz fuer den Groessen-Griff
  win.swDe:Update()
  y = y - 30 - PAD
  win:SetHeight(-y)
end

-- ---------------------------------------------------------------- Ein-/Ausschalten
local TINY = 0.01
local guardScale, guardAlpha
local function HideRXP(on)
  local F = RXPF()
  if not F then return end
  if not F.rxnHooked then
    F.rxnHooked = true
    -- RXP setzt Groesse/Deckkraft bei Einstellungen neu -> im Neon-Fenster-Modus sofort wieder unsichtbar
    hooksecurefunc(F, "SetScale", function(self, s)
      if guardScale or not N.Fenster.active then return end
      if s ~= TINY then guardScale = true; self:SetScale(TINY); guardScale = false end
    end)
    hooksecurefunc(F, "SetAlpha", function(self, a)
      if guardAlpha or not N.Fenster.active then return end
      if a ~= 0 then guardAlpha = true; self:SetAlpha(0); guardAlpha = false end
    end)
  end
  local r = RXPr(); local prof = r and r.settings and r.settings.profile
  if on then
    -- WICHTIG: nicht verstecken – RXP pausiert sonst (isHidden) Auto-Annehmen und Schritt-Pruefung
    guardScale, guardAlpha = true, true
    F:SetScale(TINY); F:SetAlpha(0); F:EnableMouse(false)
    guardScale, guardAlpha = false, false
  else
    guardScale, guardAlpha = true, true
    F:SetScale((prof and prof.windowScale) or 1); F:SetAlpha(1); F:EnableMouse(true)
    guardScale, guardAlpha = false, false
  end
end

function N.Fenster.Apply()
  local db = DB()
  if not db then return end
  if N.extern then
    -- LevelPilot 7 zeigt den RXP-Guide in seinem Fenster: eigenes Fenster aus, RXPs Fenster bleibt
    -- unsichtbar (regelt LevelPilot). Deutsche Texte von RXPNeon laufen weiter.
    N.Fenster.active = false
    if win then win:Hide() end
    return
  end
  local want = db.skin and db.fenster ~= "rxp" and RXPr() ~= nil
  if want then
    Build()
    N.Fenster.active = true
    win:SetScale(db.scale or 1)
    win:Show()
    HideRXP(true)
    N.Fenster.Refresh()
  else
    N.Fenster.active = false
    if win then win:Hide() end
    HideRXP(false)
  end
end

function N.Fenster.Frame() return win end
function N.Fenster.Reset()
  if not win then return end
  DB().pos = nil
  win:ClearAllPoints(); win:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 24, -190)
end
