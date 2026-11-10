-- Tiry's Zentrale – Einsteiger-Assistent beim ersten Öffnen: 3 Schritte (erkannt / Preise / erster Goldweg)
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market

local W = {}
UI.Wizard = W
local overlay

local FACTION = { Alliance = "Allianz", Horde = "Horde" }
local CLASS = { WARRIOR = "Krieger", PALADIN = "Paladin", HUNTER = "Jäger", ROGUE = "Schurke", PRIEST = "Priester",
  SHAMAN = "Schamane", MAGE = "Magier", WARLOCK = "Hexenmeister", DRUID = "Druide" }

local function steps()
  local p = ns.player
  local profs = {}
  for id, pr in pairs(ns.professions) do profs[#profs + 1] = pr.name .. " (" .. pr.rank .. ")" end
  table.sort(profs)
  local state = M.Status()
  local next = ns.Guide.NextStep()
  return {
    { title = "Hallo " .. (p.name ~= "" and p.name or "Abenteurer") .. "! Das habe ich erkannt",
      text = string.format("Fraktion: |cff39ff6b%s|r · Level |cff39ff6b%d|r · %s\nBerufe: %s\n\nAlles weitere passt Tiry's Zentrale automatisch an dich an – auch wenn du aufsteigst.",
        FACTION[p.faction] or p.faction, p.level, CLASS[p.class] or p.class,
        #profs > 0 and table.concat(profs, ", ") or "noch keine – kein Problem, der Berufe-Berater hilft dir") },
    { title = "Preise: Auctionator",
      text = state == "ok" and "|cff61eb8fAuctionator ist verbunden und hat Preise.|r Tiry's Zentrale rechnet ab jetzt mit den echten Preisen deines Servers."
        or state == "empty" and "Auctionator ist da, hat aber noch keine Preise.\nSo geht's: Zum Auktionshaus gehen, öffnen, oben rechts auf \"AH scannen\" klicken. Fertig."
        or "|cffff6b81Auctionator fehlt.|r Ohne Preise rät man nur.\nInstalliere das kostenlose Addon \"Auctionator\" (Version für WoW Forever) und tippe danach /reload." },
    { title = "Dein erster Schritt: " .. next.title,
      text = next.text .. "\n\nDiesen Tipp findest du immer oben auf der Startseite – er passt sich an, sobald du ihn erledigt hast.",
      button = next.button, action = next.action },
  }
end

local function create(parent)
  local o = CreateFrame("Frame", nil, parent)
  o:SetAllPoints()
  o:SetFrameLevel(parent:GetFrameLevel() + 40)
  o:EnableMouse(true)
  o.shade = o:CreateTexture(nil, "BACKGROUND")
  o.shade:SetAllPoints()
  o.shade:SetColorTexture(0.02, 0.03, 0.03, 0.82)
  local card = CreateFrame("Frame", nil, o)
  card:SetSize(600, 330)
  card:SetPoint("CENTER", 0, 20)
  card.glass = UI.Glass(card, { radius = 28, edgeMode = "neon", edge = 0.8, halo = 0.3, haloPad = 34,
    body = UI.GLASS.hero, sheen = 0.06, sheenH = 70, line = 0.55 })
  card.bg = card.glass.body
  card.shine = UI.Glow(card, C.amber, 360, 0.16, "BORDER")
  card.shine:SetHeight(260)
  card.shine:SetPoint("CENTER", card, "LEFT", 200, 20)
  UI.Drift(card.shine, 160, -20, 9, 0.3, 0.1)
  card.step = UI.Text(card, 12, "bold", C.amber)
  card.step:SetPoint("TOPLEFT", 28, -24)
  card.title = UI.Text(card, 19, "bold", C.text)
  card.title:SetPoint("TOPLEFT", card.step, "BOTTOMLEFT", 0, -8)
  card.title:SetWidth(544)
  card.title:SetWordWrap(false)
  card.text = UI.Para(card, 13, C.muted, 544)
  card.text:SetPoint("TOPLEFT", card.title, "BOTTOMLEFT", 0, -14)
  card.skip = UI.Button(card, "Überspringen", "ghost", 150, 36)
  card.skip:SetPoint("BOTTOMLEFT", 24, 22)
  card.back = UI.Button(card, "Zurück", "soft", 120, 36)
  card.back:SetPoint("BOTTOMRIGHT", -210, 22)
  card.next = UI.Button(card, "Weiter", "primary", 170, 36, "chevron")
  card.next:SetPoint("BOTTOMRIGHT", -24, 22)
  o.card = card
  card.skip:SetScript("OnClick", function() W.Finish() end)
  card.back:SetScript("OnClick", function() W.Go(o.index - 1) end)
  card.next:SetScript("OnClick", function()
    local s = o.steps[o.index]
    if o.index >= #o.steps then
      W.Finish()
      if s.action then s.action() end
    else
      W.Go(o.index + 1)
    end
  end)
  o:Hide()
  return o
end

function W.Go(i)
  if not overlay then return end
  overlay.steps = steps()
  i = ns.Clamp(i, 1, #overlay.steps)
  overlay.index = i
  local s = overlay.steps[i]
  local card = overlay.card
  card.step:SetText("SCHRITT " .. i .. " VON " .. #overlay.steps)
  card.title:SetText(s.title)
  card.text:SetText(s.text)
  card.back:SetShown(i > 1)
  card.next:SetLabel(i < #overlay.steps and "Weiter" or (s.button or "Los geht's"))
end

function W.Show()
  if not UI.frame then return end
  overlay = overlay or create(UI.frame)
  W.frame = overlay
  overlay:Show()
  W.Go(1)
end

function W.Finish()
  ns.settings.wizardDone = true
  if overlay then overlay:Hide() end
  UI.RefreshPage("home")
end

function W.IsShown()
  return overlay and overlay:IsShown()
end
