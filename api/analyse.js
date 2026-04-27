export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, mediaType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image manquante' });
    }

    const prompt = `Tu es un assistant qui extrait des transactions financières depuis des captures d'écran d'historiques Wave ou Orange Money sénégalais.

Analyse cette image et extrais uniquement les transactions PERTINENTES selon ces règles strictes :

INCLURE comme SORTIE :
- Transfert envoyé / Transfert effectué / Envoi effectué
- "À [nom]" avec montant négatif
- Achat crédit, achat forfait
- Paiement marchand

INCLURE comme ENTREE :
- Transfert reçu
- "De [nom]" avec montant positif

IGNORER complètement :
- Retraits (l'argent reste dans le patrimoine, juste changement de forme)
- Dépôts reçus (rechargement de compte mobile)
- Frais de transaction

Pour chaque transaction retenue, retourne un objet JSON avec :
- date: format YYYY-MM-DD (si seulement jour/mois visible, utilise 2026 comme année)
- montant: nombre positif (valeur absolue)
- sens: "sortie" ou "entree"
- commentaire: nom de la personne ou description courte
- operateur: "Wave" ou "Orange Money" selon le style de l'interface

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après.
Exemple: [{"date":"2026-04-26","montant":5000,"sens":"sortie","commentaire":"Adja Diaw","operateur":"Wave"}]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || '[]';
    const clean = raw.replace(/```json|```/g, '').trim();
    const transactions = JSON.parse(clean);

    return res.status(200).json({ transactions });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
