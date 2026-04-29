-- Create referral email templates
INSERT INTO email_templates (name, subject, body, variables, is_active) VALUES
(
  'Parrainage - Bienvenue filleul',
  'Bienvenue ! Profitez de votre abonnement',
  'Bonjour {{referred_name}},

Nous sommes ravis de vous accueillir parmi nous !

Vous avez été parrainé par {{referrer_name}}, qui vous fait découvrir nos services.

Vos identifiants d''accès :
- Login : {{login}}
- Mot de passe : {{password}}

Pour vous connecter et profiter de votre abonnement, rendez-vous sur votre Espace Client.

Si vous avez des questions, n''hésitez pas à nous contacter.

Cordialement,
L''équipe',
  '["referred_name", "referrer_name", "login", "password"]'::jsonb,
  true
),
(
  'Parrainage - Bonus parrain',
  '🎉 Félicitations ! Vous avez reçu {{bonus_months}} mois bonus',
  'Félicitations {{referrer_name}} !

Votre filleul {{referred_email}} vient de souscrire et de valider son abonnement.

En remerciement de votre parrainage, nous avons le plaisir de vous offrir :

{{bonus_months}} mois offert{{bonus_plural}}

Votre abonnement a été prolongé jusqu''au {{new_end_date}}.

Ce bonus a été automatiquement ajouté à votre compte. Vous pouvez consulter votre nouvelle date d''expiration dans votre Espace Client.

Merci de faire confiance à nos services et de les recommander !

Cordialement,
L''équipe',
  '["referrer_name", "referred_email", "bonus_months", "bonus_plural", "new_end_date"]'::jsonb,
  true
);