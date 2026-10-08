# Gera casos aleatórios fisiologicamente coerentes (pH por Henderson-Hasselbalch, pK 6,1, s 0,0307)
import random, json, math
random.seed(20261008)
casos=[]
for i in range(3000):
    pco2=round(random.uniform(15,100),1); hco3=round(random.uniform(5,45),1)
    ph=round(6.1+math.log10(hco3/(0.0307*pco2)),2)
    if not 6.8<=ph<=7.8: continue
    c=dict(pH=ph,pco2=pco2,hco3=hco3,na=random.randint(125,155),cl=random.randint(85,125),
           alb=round(random.uniform(1.5,5),1),lact=round(random.uniform(0.5,12),1),k=round(random.uniform(2.5,7),1),
           cai=round(random.uniform(.8,1.4),2),mg=round(random.uniform(1.2,3.5),1),fosf=round(random.uniform(1.5,7),1),
           pao2=random.randint(40,500),fio2=random.choice([21,30,40,50,60,80,100]),idade=random.randint(18,90),
           ctx={"cronico":random.random()<0.3})
    if random.random()<0.2: c.pop("alb")
    if random.random()<0.2: c.pop("na"); c.pop("cl")
    casos.append(c)
json.dump(casos,open("casos.json","w"))
print(len(casos))
