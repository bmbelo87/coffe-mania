globalThis.JuiceModularLayout = {
  "version": 2,
  "scope": "Assets separados para montagem; não altera a interface ativa do jogo.",
  "canvas": {
    "width": 594,
    "height": 508
  },
  "contentTop": 119,
  "overlap": 2,
  "parts": [
    {
      "id": "panel",
      "source": "panel-final.png",
      "file": "painel-vazio.png",
      "width": 594,
      "height": 508,
      "x": 0,
      "y": 0,
      "sourceCrop": {
        "left": 31,
        "top": 40,
        "width": 1289,
        "height": 1085
      },
      "sourceSeam": 273
    },
    {
      "id": "tab-active",
      "source": "tab-active.png",
      "file": "aba-ativa.png",
      "width": 130,
      "height": 35,
      "sourceCrop": {
        "left": 64,
        "top": 140,
        "width": 1964,
        "height": 461
      }
    },
    {
      "id": "tab-inactive",
      "source": "tab-inactive.png",
      "file": "aba-inativa.png",
      "width": 130,
      "height": 35,
      "sourceCrop": {
        "left": 98,
        "top": 130,
        "width": 1897,
        "height": 503
      }
    },
    {
      "id": "tab-locked",
      "source": "tab-locked.png",
      "file": "aba-bloqueada.png",
      "width": 130,
      "height": 35,
      "sourceCrop": {
        "left": 88,
        "top": 205,
        "width": 1843,
        "height": 374
      }
    },
    {
      "id": "machine-window",
      "source": "machine-window.png",
      "file": "janela-maquina.png",
      "width": 154,
      "height": 162,
      "x": 28,
      "y": 135,
      "sourceCrop": {
        "left": 24,
        "top": 42,
        "width": 1174,
        "height": 1210
      }
    },
    {
      "id": "evolution-background",
      "source": "evolution-background.png",
      "file": "evolucao-fundo.png",
      "width": 154,
      "height": 174,
      "x": 28,
      "y": 314,
      "sourceCrop": {
        "left": 25,
        "top": 45,
        "width": 1130,
        "height": 1250
      }
    },
    {
      "id": "evolution-title",
      "source": "evolution-title.png",
      "file": "evolucao-titulo.png",
      "width": 140,
      "height": 49,
      "x": 35,
      "y": 319,
      "preserveAspect": true,
      "sourceCrop": {
        "left": 253,
        "top": 70,
        "width": 1634,
        "height": 603
      }
    },
    {
      "id": "evolution-silhouette",
      "source": "evolution-silhouette.png",
      "file": "evolucao-silhueta.png",
      "width": 62,
      "height": 82,
      "x": 74,
      "y": 372,
      "preserveAspect": true,
      "sourceCrop": {
        "left": 137,
        "top": 233,
        "width": 802,
        "height": 1087
      }
    },
    {
      "id": "recipe-card",
      "source": "recipe-card.png",
      "file": "linha-suco.png",
      "width": 362,
      "height": 77,
      "sourceCrop": {
        "left": 29,
        "top": 137,
        "width": 2092,
        "height": 452
      }
    },
    {
      "id": "recipe-card-serving",
      "source": "recipe-card-serving.png",
      "file": "linha-suco-servindo.png",
      "width": 362,
      "height": 77,
      "sourceCrop": {
        "left": 46,
        "top": 170,
        "width": 1986,
        "height": 406
      }
    }
  ],
  "tabs": {
    "positions": [
      {
        "x": 12,
        "y": 86,
        "width": 130,
        "height": 35
      },
      {
        "x": 147,
        "y": 86,
        "width": 130,
        "height": 35
      },
      {
        "x": 284,
        "y": 86,
        "width": 130,
        "height": 35
      },
      {
        "x": 419,
        "y": 86,
        "width": 130,
        "height": 35
      }
    ],
    "labels": [
      "Simples",
      "Elaborados",
      "Poderosos",
      "Exóticos"
    ],
    "attachment": "A base das abas sobrepõe 2 px do corpo; a aba ativa não tem contorno inferior."
  },
  "evolutionCaption": {
    "text": "Aprimore seus sucos\npara descobrir!",
    "x": 39,
    "y": 455,
    "width": 132,
    "height": 28,
    "font": "Arial",
    "fontSize": 11,
    "color": "#174d70"
  },
  "existing": {
    "logo": {
      "file": "../logo.png",
      "x": 152,
      "y": -10,
      "width": 286,
      "height": 84,
      "preserveAspect": true
    },
    "machine": {
      "file": "../../../items/juice_machine/stages/stage-1.png",
      "x": 41,
      "y": 139,
      "width": 128,
      "height": 153,
      "preserveAspect": true
    },
    "drinks": {
      "folder": "../../../juices/",
      "ids": [
        "orange",
        "grape",
        "lemon",
        "pineapple"
      ],
      "rows": [
        135,
        225,
        315,
        405
      ]
    },
    "close": {
      "file": "../../buttons_collection_1.png",
      "frame": {
        "x": 1206,
        "y": 297,
        "width": 227,
        "height": 234
      },
      "x": 541,
      "y": -6,
      "width": 26,
      "height": 26
    },
    "resourceIcons": {
      "atlas": "../../icon_bundle_1.png",
      "energy": "../../resource-icons/energy-blue.png"
    },
    "buttonsAndProgress": "Reutilizar os componentes atuais de JuiceInterfaceParts.ts/CookScreenModal.ts; não foram gerados ícones ou botões novos."
  },
  "provenance": "Reconstrução raster com imagegen baseada na captura; não é extração pixel a pixel do original. Prompts em prompts.json, fontes intactas em sources/."
};
