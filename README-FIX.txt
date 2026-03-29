Correctifs appliqués :
1. getEmissionFactor : override accepté seulement si > 0
2. score mesure capturé avant décrément de remaining
3. parseFrNumber + globals : garde Number.isFinite au lieu de ??
4. fmtEur(0) => Gratuit
5. pTxt initial corrigé à 1/4 + goToStep(0) au chargement
6. coefIntensite ajouté dans l'UI
7. validation des sites avant calcul (surface / cRef / cAct)
