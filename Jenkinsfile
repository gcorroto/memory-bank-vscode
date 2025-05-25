@Library('jenkins-voip-reporter@main') _

pipeline {
  agent any

  parameters {
    string(name: 'DEPLOY_HOST', defaultValue: '192.168.4.44', description: 'Host donde está tu HTTP server')
    string(name: 'DEPLOY_USER', defaultValue: 'usuario',        description: 'Usuario SSH para la copia')
    string(name: 'DEPLOY_PATH', defaultValue: '/opt/artifacts',  description: 'Ruta destino de los .vsix')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Build VSIX') {
      agent { label 'docker' }
      steps {
        sh '''
          # Preparamos carpeta de salida
          rm -rf out && mkdir out
          # Arrancamos el builder aislado (Dockerfile.builder + docker-compose.build.yml)
          docker-compose -f docker-compose.build.yml up --build --rm
        '''
      }
    }

    stage('Locate VSIX') {
      steps {
        script {
          // Detectamos automáticamente el nombre del .vsix generado
          def files = sh(
            script: "ls out/*.vsix",
            returnStdout: true
          ).trim().split("\\n")
          if (files.size() != 1) {
            error "Esperaba un único .vsix en out/, pero encontré: ${files}"
          }
          env.VSIX_FILE = files[0].tokenize('/').last()
        }
      }
    }

    stage('Publish VSIX') {
      steps {
        sshagent(['deploy-key']) {
          sh """
            scp out/${env.VSIX_FILE} \
                ${params.DEPLOY_USER}@${params.DEPLOY_HOST}:${params.DEPLOY_PATH}/
          """
        }
      }
    }
  }

  post {
    success {
      echo "✅ VSIX publicado en http://${params.DEPLOY_HOST}:12488/${env.VSIX_FILE}"
    }
    failure {
      echo "❌ Falló el pipeline."
    }
  }
}
