import fs from 'fs';

const filePath = 'components/Editor.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { target: /setTooltip\({[\s\n]*label: isPlaying \? 'Pausar Animação' : 'Visualizar Animação',[\s\n]*description: isPlaying \? 'Pausa a reprodução da animação\.' : 'Inicia a reprodução da animação na área de desenho\.',/g, replacement: 'setTooltip({\n                      label: isPlaying ? t(\'pauseAnimation\') : t(\'playAnimation\'),\n                      description: isPlaying ? t(\'pauseAnimationDesc\') : t(\'playAnimationDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: 'Novo Quadro',[\s\n]*description: 'Adiciona um novo quadro de animação\.',/g, replacement: 'setTooltip({\n                        label: t(\'newFrame\'),\n                        description: t(\'newFrameDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: 'Pixel Perfect',[\s\n]*description: 'Remove pixels extras em diagonais para criar linhas mais limpas\.',/g, replacement: 'setTooltip({ \n                            label: t(\'pixelPerfect\'), \n                            description: t(\'pixelPerfectDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: 'Excluir Paleta',[\s\n]*description: 'Remove esta paleta permanentemente\.',/g, replacement: 'setTooltip({\n                                      label: t(\'deletePalette\'),\n                                      description: t(\'deletePaletteDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: 'Renomear',[\s\n]*description: 'Altera o nome da camada\.',/g, replacement: 'setTooltip({\n                  label: t(\'rename\'),\n                  description: t(\'renameDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: layer\.isVisible \? 'Ocultar' : 'Mostrar',[\s\n]*description: 'Alterna a visibilidade da camada\.',/g, replacement: 'setTooltip({\n                    label: layer.isVisible ? t(\'hide\') : t(\'show\'),\n                    description: t(\'layerVisibilityDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: layer\.isLocked \? 'Desbloquear' : 'Bloquear',[\s\n]*description: 'Bloqueia ou desbloqueia a camada\.',/g, replacement: 'setTooltip({\n                    label: layer.isLocked ? t(\'unlock\') : t(\'lock\'),\n                    description: t(\'lockDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: layer\.clipToBelow \? 'Desativar Máscara' : 'Ativar Máscara',[\s\n]*description: 'Oculta pixels se as camadas abaixo forem transparentes\.',/g, replacement: 'setTooltip({\n                    label: layer.clipToBelow ? t(\'disableMask\') : t(\'enableMask\'),\n                    description: t(\'maskDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: frame\.isLocked \? 'Desbloquear' : 'Bloquear',[\s\n]*description: 'Bloqueia ou desbloqueia o quadro\.',/g, replacement: 'setTooltip({\n                label: frame.isLocked ? t(\'unlockFrame\') : t(\'lockFrame\'),\n                description: t(\'lockFrameDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: frame\.onionSkin \? 'Desativar Papel de Seda' : 'Ativar Papel de Seda',[\s\n]*description: 'Mostra o quadro anterior como referência\.',/g, replacement: 'setTooltip({\n                label: frame.onionSkin ? t(\'disableOnionSkin\') : t(\'enableOnionSkin\'),\n                description: t(\'onionSkinDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: 'Duplicar',[\s\n]*description: 'Cria uma cópia deste quadro\.',/g, replacement: 'setTooltip({\n                label: t(\'duplicate\'),\n                description: t(\'duplicateDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: 'Excluir',[\s\n]*description: 'Remove este quadro permanentemente\.',/g, replacement: 'setTooltip({\n                  label: t(\'delete\'),\n                  description: t(\'deleteFrameDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: isLocked \? 'Desbloquear Cor' : 'Bloquear Cor',[\s\n]*description: 'Impede que a cor seja alterada\.',/g, replacement: 'setTooltip({\n            label: isLocked ? t(\'unlockColor\') : t(\'lockColor\'),\n            description: t(\'lockColorDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: 'Copiar Cor',[\s\n]*description: 'Adiciona uma cópia desta cor a uma paleta\.',/g, replacement: 'setTooltip({\n            label: t(\'copyColor\'),\n            description: t(\'copyColorDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: 'Remover Cor',[\s\n]*description: 'Remove esta cor da paleta\.',/g, replacement: 'setTooltip({\n              label: t(\'removeColor\'),\n              description: t(\'removeColorDesc\'),' },
  { target: /setTooltip\({[\s\n]*label: color === 'transparent' \? 'Transparente' : color\.toUpperCase\(\),/g, replacement: 'setTooltip({\n              label: color === \'transparent\' ? t(\'transparent\') : color.toUpperCase(),' },
];

replacements.forEach(({ target, replacement }) => {
  content = content.replace(target, replacement);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Remaining tooltips replaced successfully.');
