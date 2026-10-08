# Calculadora de referência escrita à parte, direto das fórmulas publicadas, para conferir o motor do app.
# Berend NEJM 2014 (tabela 1), Winters 1967, Figge 1998, Rastegar 2007, Story Anesth Analg 2016 (S.A.L.T),
# Fencl AJRCCM 2000 / Figge (SIDe), equação completa do gás alveolar, Van Slyke (CLSI C46-A2).
import json, math, sys
casos=json.load(open("casos.json")); app=json.load(open(sys.argv[1]))
def ref(c):
    pH,pco2,hco3=c["pH"],c["pco2"],c["hco3"]; cron=c["ctx"]["cronico"]
    o={"num":{},"ids":set()}
    o["num"]["sbe"]=0.93*(hco3-24.4+14.83*(pH-7.4))
    o["num"]["pHcalc"]=-math.log10(24*pco2/hco3*1e-9)
    prim=[]
    if pH<7.35:
        if hco3<22: prim.append("am")
        if pco2>45: prim.append("ar")
        if not prim:
            if hco3<24: prim.append("am")
            if pco2>40: prim.append("ar")
    elif pH>7.45:
        if hco3>26: prim.append("lm")
        if pco2<35: prim.append("lr")
        if not prim:
            if hco3>24: prim.append("lm")
            if pco2<40: prim.append("lr")
    else:
        if pco2>45 and hco3>26: prim.append("ar" if pH<7.4 else "lm")
        if pco2<35 and hco3<22: prim.append("am" if pH<7.4 else "lr")
    ids=o["ids"]; href=24
    for p in prim:
        if p=="am":
            ids.add("acid_met"); w=1.5*hco3+8; o["num"]["winter"]=(w-2,w+2)
            if pco2>w+2: ids.add("acid_resp")
            elif pco2<w-2: ids.add("alk_resp")
        if p=="lm":
            ids.add("alk_met"); w=40+0.7*(hco3-24); o["num"]["alk"]=(w-2,w+2)
            if pco2>w+2: ids.add("acid_resp")
            elif pco2<w-2: ids.add("alk_resp")
        if p=="ar":
            ids.add("acid_resp"); d=(pco2-40)/10
            lo,hi=((24+4*d-2,24+5*d+2) if cron else (24+d-2,24+d+2)); href=24+(4.5*d if cron else d)
            o["num"]["hco3esp"]=(lo,hi)
            if hco3>hi: ids.add("alk_met")
            elif hco3<lo: ids.add("acid_met")
        if p=="lr":
            ids.add("alk_resp"); d=(40-pco2)/10
            lo,hi=((24-5*d-2,24-4*d+2) if cron else (24-2*d-2,24-2*d+2)); href=24-(4.5*d if cron else 2*d)
            o["num"]["hco3esp"]=(lo,hi)
            if hco3<lo: ids.add("acid_met")
            elif hco3>hi: ids.add("alk_met")
    o["ag"]=None
    if "na" in c:
        ag=c["na"]-c["cl"]-hco3; o["num"]["ag"]=ag
        agc=ag+2.5*(4-c["alb"]) if "alb" in c else ag
        if "alb" in c: o["num"]["agc"]=agc
        if agc>14:
            ids.add("acid_met"); o["ag"]="alto"
            dh=href-hco3
            if dh>0.5:
                r=(agc-12)/dh; o["num"]["dd"]=r
                if r<0.8: ids.add("acid_met_nag")
                elif r>2: ids.add("alk_met")
            else: ids.add("alk_met")
        elif "acid_met" in ids: o["ag"]="normal"
        sbe=o["num"]["sbe"]; nacl=c["na"]-c["cl"]-35
        alb=0.25*(42-c["alb"]*10) if "alb" in c else 0; lac=1-c["lact"]
        o["num"].update(nacl=nacl,albef=alb if "alb" in c else None,lacef=lac,outros=sbe-nacl-alb-lac)
        if "alb" in c:
            sida=c["na"]+c["k"]+2*c["cai"]+2*c["mg"]/2.43-c["cl"]-c["lact"]
            side=hco3+c["alb"]*10*(0.123*pH-0.631)+c["fosf"]/3.1*(0.309*pH-0.469)
            o["num"].update(sida=sida,side=side,sig=sida-side)
    f=c["fio2"]/100
    o["num"]["pf"]=c["pao2"]/f
    pA=f*(760-47)-pco2*(f+(1-f)/0.8); o["num"]["aa"]=pA-c["pao2"]
    return o
def rng(s):
    if s is None: return (None,None)
    a,b=s.replace("−","-").split("–"); return float(a),float(b)
erros={}; n=0
def chk(nome,i,esp,val,tol):
    global n; n+=1
    if val is None or abs(esp-val)>tol: erros.setdefault(nome,[]).append((i,round(esp,3),val))
for i,(c,a) in enumerate(zip(casos,app)):
    R=ref(c); N=R["num"]; C=a["calc"]
    chk("SBE estimado",i,N["sbe"],a["sbe"],0.051)
    chk("pH calculado",i,N["pHcalc"],C.get("pH calculado (Henderson)"),0.0051)
    if "winter" in N: x=rng(C.get("PaCO₂ esperada (Winter)")); chk("Winter",i,N["winter"][0],x[0],0.051); chk("Winter",i,N["winter"][1],x[1],0.051)
    if "alk" in N: x=rng(C.get("PaCO₂ esperada")); chk("PaCO2 esp. alc. met.",i,N["alk"][0],x[0],0.051); chk("PaCO2 esp. alc. met.",i,N["alk"][1],x[1],0.051)
    if "hco3esp" in N:
        k=[k for k in C if k.startswith("HCO₃⁻ esperado")]; x=rng(C[k[0]] if k else None)
        chk("HCO3 esperado resp.",i,N["hco3esp"][0],x[0],0.051); chk("HCO3 esperado resp.",i,N["hco3esp"][1],x[1],0.051)
    if "ag" in N: chk("Ânion gap",i,N["ag"],C.get("Ânion gap"),0.051)
    if "agc" in N: chk("AG corrigido",i,N["agc"],C.get("AG corrigido (albumina)"),0.051)
    if "dd" in N: chk("Delta-delta",i,N["dd"],C.get("Delta-delta (ΔAG/ΔHCO₃⁻)"),0.0051)
    if "nacl" in N:
        s=a["st"]["simplificado"]
        chk("Story Na-Cl",i,N["nacl"],s["naCl"],0.051); chk("Story lactato",i,N["lacef"],s["lact"],0.051); chk("Story outros",i,N["outros"],s["outros"],0.11)
        if N["albef"] is not None: chk("Story albumina",i,N["albef"],s["alb"],0.051)
    if "sig" in N:
        co=a["st"]["completo"]; chk("SIDa",i,N["sida"],co["sida"],0.051); chk("SIDe",i,N["side"],co["side"],0.051); chk("SIG",i,N["sig"],co["sig"],0.11)
    chk("P/F",i,N["pf"],a["ox"]["pf"],0.51); chk("Gradiente A-a",i,N["aa"],a["ox"]["aa"],0.51)
    if sorted(R["ids"])!=a["ids"]: erros.setdefault("Classificação dos distúrbios",[]).append((i,sorted(R["ids"]),a["ids"]))
    n+=1
    if R["ag"]!=a["ag"]: erros.setdefault("Tipo de AG",[]).append((i,R["ag"],a["ag"]))
print(f"{len(casos)} casos, {n} comparações")
for k,v in erros.items(): print(f"  DIVERGE {k}: {len(v)} casos; ex.: {v[:2]}")
if not erros: print("  Tudo bate.")
