#!/usr/bin/env bash
# setup_es_pipeline.sh
#
# Crée dans Elasticsearch :
#   1. L'index template pour siem-logs (mapping strict)
#   2. L'ingest pipeline "siem-enrichment-pipeline" qui :
#        - parse le timestamp
#        - classifie la sévérité en score numérique
#        - ajoute un champ ai_alert (level + reason) via règles de seuil
#        - détecte les patterns bruteforce/off-hours/suspicious
#   3. L'index logs_analyzed pour les résultats enrichis
#
# Usage :
#   chmod +x setup_es_pipeline.sh
#   ./setup_es_pipeline.sh
#
# Variables configurables :
ES_HOST="${ES_HOST:-https://localhost:9200}"
ES_USER="${ES_USER:-elastic}"
ES_PASSWORD="${ES_PASSWORD:-changeme}"
ES_OPTS="-ku ${ES_USER}:${ES_PASSWORD}"   # -k = skip TLS verify

echo "=== [1/3] Création du template d'index siem-logs ==="
curl $ES_OPTS -X PUT "${ES_HOST}/_index_template/siem-logs-template" \
  -H "Content-Type: application/json" -d '{
  "index_patterns": ["siem-logs*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "default_pipeline": "siem-enrichment-pipeline"
    },
    "mappings": {
      "properties": {
        "id":           { "type": "keyword" },
        "timestamp":    { "type": "date" },
        "created_at":   { "type": "date" },
        "source_ip":    { "type": "ip" },
        "dest_ip":      { "type": "ip" },
        "host":         { "type": "keyword" },
        "username":     { "type": "keyword" },
        "log_type":     { "type": "keyword" },
        "severity":     { "type": "keyword" },
        "raw_message":  { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
        "is_suspicious":{ "type": "boolean" },
        "note":         { "type": "text" },
        "batch_id":     { "type": "keyword" },
        "es_indexed":   { "type": "boolean" },
        "node_id":      { "type": "keyword" },
        "ai_alert": {
          "properties": {
            "level":    { "type": "keyword" },
            "reason":   { "type": "text" },
            "score":    { "type": "float" }
          }
        }
      }
    }
  }
}'
echo -e "\n"

echo "=== [2/3] Création de l'ingest pipeline 'siem-enrichment-pipeline' ==="
curl $ES_OPTS -X PUT "${ES_HOST}/_ingest/pipeline/siem-enrichment-pipeline" \
  -H "Content-Type: application/json" -d '{
  "description": "Pipeline SIEM CTU — enrichissement et détection par règles",
  "processors": [

    {
      "date": {
        "field": "timestamp",
        "target_field": "@timestamp",
        "formats": ["ISO8601", "yyyy-MM-dd'\''T'\''HH:mm:ssZ"],
        "ignore_failure": true
      }
    },

    {
      "script": {
        "description": "Encode severity en score numérique",
        "lang": "painless",
        "source": "
          Map sev = ['\''info'\'': 0, '\''warning'\'': 1, '\''error'\'': 2, '\''critical'\'': 3];
          String s = ctx.containsKey('\''severity'\'') ? ctx.severity.toLowerCase() : '\''info'\'';
          ctx.severity_score = sev.containsKey(s) ? sev[s] : 0;
        "
      }
    },

    {
      "script": {
        "description": "Détection par règles — produit ai_alert.level et ai_alert.reason",
        "lang": "painless",
        "source": "
          String level = '\''none'\'';
          String reason = '\'''\'' ;

          // Règle 1 : log déjà flaggé par agent
          if (ctx.containsKey('\''is_suspicious'\'') && ctx.is_suspicious == true) {
            level = '\''high'\'';
            reason += '\''Agent flag: is_suspicious=true. '\'';
          }

          // Règle 2 : severity critique
          if (ctx.severity_score >= 3) {
            level = '\''critical'\'';
            reason += '\''Severity critique détectée. '\'';
          }

          // Règle 3 : accès chemin suspect dans raw_message
          String[] suspPaths = ['\''/admin'\'', '\''/backup'\'', '\''/.env'\'', '\''/config'\'',
                                  '\''passwd'\'', '\''phpmyadmin'\'', '\''wp-admin'\''];
          if (ctx.containsKey('\''raw_message'\'')) {
            for (String p : suspPaths) {
              if (ctx.raw_message.toLowerCase().contains(p)) {
                if (level.equals('\''none'\'') || level.equals('\''low'\'')) level = '\''medium'\'';
                reason += '\''Suspicious path detected: '\'' + p + '\''. '\'';
                break;
              }
            }
          }

          // Règle 4 : user-agent offensif
          String[] suspUA = ['\''sqlmap'\'', '\''nikto'\'', '\''masscan'\'', '\''nmap'\''];
          if (ctx.containsKey('\''raw_message'\'')) {
            for (String ua : suspUA) {
              if (ctx.raw_message.toLowerCase().contains(ua)) {
                level = '\''high'\'';
                reason += '\''Offensive tool UA: '\'' + ua + '\''. '\'';
                break;
              }
            }
          }

          // Règle 5 : auth failure
          if (ctx.containsKey('\''log_type'\'') && ctx.log_type == '\''auth'\''
              && ctx.severity_score >= 2) {
            if (level.equals('\''none'\'')) level = '\''medium'\'';
            reason += '\''Auth failure event. '\'';
          }

          // Règle 6 : heure suspecte (1h-5h UTC)
          if (ctx.containsKey('\''@timestamp'\'')) {
            ZonedDateTime zdt = ZonedDateTime.parse(ctx['\''@timestamp'\''].toString());
            int hour = zdt.getHour();
            if (hour >= 1 && hour <= 5) {
              if (level.equals('\''none'\'') || level.equals('\''low'\'')) level = '\''medium'\'';
              reason += '\''Off-hours access (0'\''+ hour + '\''h UTC). '\'';
            }
          }

          // Règle 7 : source IP externe + log_type auth
          if (ctx.containsKey('\''log_type'\'') && ctx.log_type == '\''auth'\'') {
            String sip = ctx.containsKey('\''source_ip'\'') ? ctx.source_ip : '\'''\'' ;
            if (!sip.startsWith('\''192.168'\'') && !sip.startsWith('\''10.'\''
              ) && !sip.startsWith('\''127'\'') && !sip.equals('\''::1'\'')) {
              if (level.equals('\''none'\'')) level = '\''medium'\'';
              reason += '\''External IP auth attempt: '\'' + sip + '\''. '\'';
            }
          }

          if (level.equals('\''none'\'')) { level = '\''low'\''; reason = '\''No anomaly detected.'\''; }
          ctx.ai_alert = ['\''level'\'': level, '\''reason'\'': reason.trim(), '\''score'\'': ctx.severity_score];
        "
      }
    },

    {
      "set": {
        "field": "es_indexed",
        "value": true
      }
    }
  ],

  "on_failure": [
    {
      "set": {
        "field": "pipeline_error",
        "value": "{{_ingest.on_failure_message}}"
      }
    }
  ]
}'
echo -e "\n"

echo "=== [3/3] Création de l'index logs_analyzed ==="
curl $ES_OPTS -X PUT "${ES_HOST}/logs-analyzed" \
  -H "Content-Type: application/json" -d '{
  "settings": { "number_of_shards": 1, "number_of_replicas": 0 },
  "mappings": {
    "properties": {
      "original_id":  { "type": "keyword" },
      "timestamp":    { "type": "date" },
      "host":         { "type": "keyword" },
      "username":     { "type": "keyword" },
      "ai_alert": {
        "properties": {
          "level":  { "type": "keyword" },
          "reason": { "type": "text" },
          "score":  { "type": "float" }
        }
      },
      "if_anomaly_score": { "type": "float" },
      "is_anomaly":       { "type": "boolean" }
    }
  }
}'
echo -e "\n"

echo "=== Vérification de la pipeline ==="
curl $ES_OPTS -X GET "${ES_HOST}/_ingest/pipeline/siem-enrichment-pipeline?pretty" \
  | head -20

echo -e "\n✅ Setup Elasticsearch terminé."
echo "   Test rapide : curl $ES_OPTS -X POST '${ES_HOST}/siem-logs/_doc?pipeline=siem-enrichment-pipeline' -H 'Content-Type: application/json' -d '{\"severity\":\"error\",\"log_type\":\"auth\",\"is_suspicious\":true,\"raw_message\":\"test\"}'"
