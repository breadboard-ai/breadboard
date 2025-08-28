# Node Grouping and Subgraph Creation

The node grouping system provides utilities for organizing graph nodes into modular subgraphs. This enables graph composition, reusability, and better organization of complex graphs.

## Overview

The `nodesToSubgraph` function moves a specified group of nodes from a graph into a new subgraph, replacing them with a single "folded" node that references the subgraph.

## Function Signature

```typescript
function nodesToSubgraph(
  graph: GraphDescriptor,
  nodeGroup: NodeIdentifier[],
  subgraphId: GraphIdentifier,
  title?: string,
  description?: string
): void
```

## Parameters

- `graph` - The graph to modify (mutated in place)
- `nodeGroup` - Array of node IDs to include in the subgraph
- `subgraphId` - Unique identifier for the new subgraph
- `title` - Optional title for the subgraph
- `description` - Optional description of the subgraph's purpose

## Process Overview

1. **Extract nodes** - Remove specified nodes from main graph
2. **Analyze edges** - Categorize edges as internal, incoming, or outgoing
3. **Create subgraph** - Build new subgraph with input/output nodes
4. **Create folded node** - Replace node group with single reference node
5. **Rewire edges** - Update main graph edges to connect to folded node

## Detailed Example

### Original Graph

```typescript
const originalGraph = {
  nodes: [
    { id: 'source', type: 'input' },
    { id: 'processA', type: 'worker' },
    { id: 'processB', type: 'worker' },
    { id: 'processC', type: 'worker' },
    { id: 'sink', type: 'output' }
  ],
  edges: [
    { from: 'source', to: 'processA', out: 'data', in: 'input' },
    { from: 'processA', to: 'processB', out: 'result', in: 'data' },
    { from: 'processB', to: 'processC', out: 'processed', in: 'input' },
    { from: 'processC', to: 'sink', out: 'final', in: 'result' }
  ]
};
```

### Grouping Nodes

```typescript
import { nodesToSubgraph } from '@breadboard-ai/runtime/static/nodes-to-subgraph.js';

// Group the middle processing nodes
nodesToSubgraph(
  originalGraph,
  ['processA', 'processB', 'processC'],  // Nodes to group
  'processing-pipeline',                 // Subgraph ID
  'Processing Pipeline',                 // Title
  'Main data processing operations'      // Description
);
```

### Resulting Graph Structure

```typescript
// Main graph after grouping
const resultGraph = {
  nodes: [
    { id: 'source', type: 'input' },
    { 
      id: 'processing-pipeline', 
      type: '#processing-pipeline',  // References subgraph
      metadata: {
        title: 'Subgraph "processing-pipeline"',
        tags: ['folded']
      }
    },
    { id: 'sink', type: 'output' }
  ],
  edges: [
    { from: 'source', to: 'processing-pipeline', out: 'data', in: 'input' },
    { from: 'processing-pipeline', to: 'sink', out: 'final', in: 'result' }
  ],
  graphs: {
    'processing-pipeline': {
      title: 'Processing Pipeline',
      description: 'Main data processing operations',
      nodes: [
        { 
          id: 'input_processing-pipeline', 
          type: 'input',
          metadata: { 
            title: 'Subgraph Input',
            description: 'Captures incoming edges to the subgraph'
          }
        },
        { id: 'processA', type: 'worker' },    // Original nodes preserved
        { id: 'processB', type: 'worker' },
        { id: 'processC', type: 'worker' },
        { 
          id: 'output_processing-pipeline', 
          type: 'output',
          metadata: { 
            title: 'Subgraph Output',
            description: 'Captures outgoing edges from the subgraph'
          }
        }
      ],
      edges: [
        // Bridge from input node to subgraph entry
        { from: 'input_processing-pipeline', to: 'processA', out: 'input', in: 'input' },
        
        // Internal edges preserved
        { from: 'processA', to: 'processB', out: 'result', in: 'data' },
        { from: 'processB', to: 'processC', out: 'processed', in: 'input' },
        
        // Bridge from subgraph exit to output node
        { from: 'processC', to: 'output_processing-pipeline', in: 'final', out: 'final' }
      ]
    }
  }
};
```

## Edge Classification and Handling

### Internal Edges
Edges between nodes within the group are preserved in the subgraph:

```typescript
// Both nodes in the group
{ from: 'processA', to: 'processB' }
// → Preserved in subgraph unchanged
```

### Incoming Edges
Edges from outside the group to nodes inside:

```typescript
// External → Internal
{ from: 'source', to: 'processA', out: 'data', in: 'input' }

// Main graph gets:
{ from: 'source', to: 'folded-node', out: 'data', in: 'input' }

// Subgraph gets:
{ from: 'input_subgraph', to: 'processA', out: 'input', in: 'input' }
```

### Outgoing Edges
Edges from nodes inside the group to external nodes:

```typescript
// Internal → External
{ from: 'processC', to: 'sink', out: 'final', in: 'result' }

// Main graph gets:
{ from: 'folded-node', to: 'sink', out: 'final', in: 'result' }

// Subgraph gets:
{ from: 'processC', to: 'output_subgraph', in: 'final', out: 'final' }
```

## Common Usage Patterns

### Creating Reusable Components

```typescript
// Define a reusable validation component
const validationNodes = ['validate-schema', 'check-constraints', 'sanitize-data'];

nodesToSubgraph(
  graph,
  validationNodes,
  'data-validator',
  'Data Validation Component',
  'Reusable data validation pipeline'
);

// The folded node can now be copied/referenced in other graphs
```

### Organizing Complex Workflows

```typescript
// Break down a complex ML pipeline
const dataPreprocessing = ['clean', 'normalize', 'feature-extract'];
const modelTraining = ['train', 'validate', 'tune-hyperparameters'];
const modelDeployment = ['package', 'deploy', 'monitor'];

// Create separate subgraphs for each stage
nodesToSubgraph(graph, dataPreprocessing, 'preprocessing', 'Data Preprocessing');
nodesToSubgraph(graph, modelTraining, 'training', 'Model Training');
nodesToSubgraph(graph, modelDeployment, 'deployment', 'Model Deployment');
```

### Encapsulating Business Logic

```typescript
// Group domain-specific operations
const orderProcessing = [
  'validate-order',
  'check-inventory',
  'calculate-pricing',
  'apply-discounts',
  'generate-invoice'
];

nodesToSubgraph(
  graph,
  orderProcessing,
  'order-processor',
  'Order Processing Engine',
  'Complete order validation and pricing logic'
);
```

## Subgraph Interface Design

### Input Node Pattern

The input node acts as the subgraph's "function signature":

```typescript
const inputNode = {
  id: `input_${subgraphId}`,
  type: 'input',
  metadata: {
    title: 'Subgraph Input',
    description: 'Captures incoming edges to the subgraph'
  }
};

// All external inputs are routed through this node
incomingEdges.forEach(edge => {
  subgraphEdges.push({
    from: `input_${subgraphId}`,
    to: edge.to,
    in: edge.in,
    out: edge.in || 'out'  // Map input port to output port
  });
});
```

### Output Node Pattern

The output node collects all subgraph outputs:

```typescript
const outputNode = {
  id: `output_${subgraphId}`,
  type: 'output',
  metadata: {
    title: 'Subgraph Output',
    description: 'Captures outgoing edges from the subgraph'
  }
};

// All external outputs are routed through this node
outgoingEdges.forEach(edge => {
  subgraphEdges.push({
    from: edge.from,
    to: `output_${subgraphId}`,
    in: edge.out || 'in',  // Map output port to input port
    out: edge.out
  });
});
```

## Multiple Input/Output Handling

### Multiple Inputs
When multiple external nodes connect to the subgraph:

```typescript
const multiInputGraph = {
  nodes: [
    { id: 'sourceA', type: 'input' },
    { id: 'sourceB', type: 'input' },
    { id: 'processor', type: 'worker' },
    { id: 'sink', type: 'output' }
  ],
  edges: [
    { from: 'sourceA', to: 'processor', out: 'dataA', in: 'inputA' },
    { from: 'sourceB', to: 'processor', out: 'dataB', in: 'inputB' },
    { from: 'processor', to: 'sink', out: 'result', in: 'final' }
  ]
};

nodesToSubgraph(multiInputGraph, ['processor'], 'multi-input-processor');

// Results in:
// - Main graph: sourceA → folded-node, sourceB → folded-node
// - Subgraph: input-node → processor (with both inputA and inputB ports)
```

### Multiple Outputs
When the subgraph connects to multiple external nodes:

```typescript
const multiOutputGraph = {
  nodes: [
    { id: 'source', type: 'input' },
    { id: 'splitter', type: 'worker' },
    { id: 'sinkA', type: 'output' },
    { id: 'sinkB', type: 'output' }
  ],
  edges: [
    { from: 'source', to: 'splitter', out: 'data', in: 'input' },
    { from: 'splitter', to: 'sinkA', out: 'partA', in: 'dataA' },
    { from: 'splitter', to: 'sinkB', out: 'partB', in: 'dataB' }
  ]
};

nodesToSubgraph(multiOutputGraph, ['splitter'], 'data-splitter');

// Results in:
// - Main graph: folded-node → sinkA, folded-node → sinkB
// - Subgraph: splitter → output-node (with both partA and partB ports)
```

## Advanced Patterns

### Nested Subgraphs

```typescript
// Create hierarchical structure
nodesToSubgraph(graph, groupA, 'component-a');
nodesToSubgraph(graph, groupB, 'component-b');

// Then group the folded nodes themselves
nodesToSubgraph(graph, ['component-a', 'component-b'], 'module-ab');
```

### Conditional Grouping

```typescript
function groupByType(graph: GraphDescriptor, nodeType: string) {
  const nodesOfType = graph.nodes
    ?.filter(node => node.type === nodeType)
    ?.map(node => node.id) || [];
  
  if (nodesOfType.length > 1) {
    nodesToSubgraph(
      graph, 
      nodesOfType, 
      `${nodeType}-group`,
      `${nodeType} Components`
    );
  }
}

// Group all nodes of the same type
groupByType(graph, 'validator');
groupByType(graph, 'transformer');
```

### Configuration-Driven Grouping

```typescript
const groupingConfig = {
  'data-processing': {
    nodes: ['clean', 'validate', 'transform'],
    title: 'Data Processing Pipeline',
    description: 'Core data processing operations'
  },
  'business-logic': {
    nodes: ['calculate', 'validate-rules', 'apply-policies'],
    title: 'Business Logic Engine',
    description: 'Domain-specific business rules'
  }
};

Object.entries(groupingConfig).forEach(([id, config]) => {
  nodesToSubgraph(graph, config.nodes, id, config.title, config.description);
});
```

## Integration with Other Systems

### With Condensation

```typescript
import { condense } from '@breadboard-ai/runtime/static/condense.js';
import { nodesToSubgraph } from '@breadboard-ai/runtime/static/nodes-to-subgraph.js';

// Handle cycles first, then organize
let processedGraph = condense(originalGraph);

// Group nodes after condensation
nodesToSubgraph(processedGraph, nodeGroup, subgraphId);
```

### With Planning

```typescript
import { createPlan } from '@breadboard-ai/runtime/static/create-plan.js';

// Organize graph structure
nodesToSubgraph(graph, processingNodes, 'processors');
nodesToSubgraph(graph, validationNodes, 'validators');

// Create execution plan from organized graph
const plan = createPlan(graph);
```

## Best Practices

### Grouping Guidelines

1. **Logical cohesion** - Group nodes that work together towards a common goal
2. **Interface minimization** - Minimize the number of edges crossing group boundaries
3. **Reusability** - Create groups that can be reused in other contexts
4. **Size management** - Keep subgraphs to a manageable size (5-20 nodes)

### Naming Conventions

```typescript
// Use descriptive, hierarchical names
'data-validation'           // Good: clear purpose
'user-auth-pipeline'        // Good: domain + function
'module-1'                  // Poor: no semantic meaning
'temp-group'                // Poor: not descriptive
```

### Documentation

```typescript
// Always provide meaningful titles and descriptions
nodesToSubgraph(
  graph,
  nodeIds,
  'payment-processor',
  'Payment Processing Engine',
  'Handles payment validation, processing, and reconciliation'
);
```

## Error Handling and Validation

### Input Validation

```typescript
function validateGrouping(
  graph: GraphDescriptor, 
  nodeGroup: NodeIdentifier[]
): boolean {
  // Check all nodes exist
  const existingNodes = new Set(graph.nodes?.map(n => n.id) || []);
  const allExist = nodeGroup.every(id => existingNodes.has(id));
  
  // Check for duplicates
  const uniqueNodes = new Set(nodeGroup);
  const noDuplicates = uniqueNodes.size === nodeGroup.length;
  
  return allExist && noDuplicates;
}

if (validateGrouping(graph, nodeGroup)) {
  nodesToSubgraph(graph, nodeGroup, subgraphId);
} else {
  throw new Error('Invalid node group for subgraph creation');
}
```

### Edge Consistency

The system automatically handles edge consistency, but you can validate the result:

```typescript
function validateSubgraphResult(graph: GraphDescriptor): boolean {
  // Check that all edge references are valid
  const allNodeIds = new Set([
    ...(graph.nodes?.map(n => n.id) || []),
    ...Object.values(graph.graphs || {}).flatMap(sg => 
      sg.nodes?.map(n => n.id) || []
    )
  ]);
  
  const allEdgesValid = [
    ...(graph.edges || []),
    ...Object.values(graph.graphs || {}).flatMap(sg => sg.edges || [])
  ].every(edge => allNodeIds.has(edge.from) && allNodeIds.has(edge.to));
  
  return allEdgesValid;
}
```

## Performance Considerations

- **Mutation warning**: The function modifies the input graph in place
- **Edge complexity**: O(E) where E is the number of edges
- **Memory usage**: Subgraphs are stored in the `graphs` property
- **Deep copying**: Consider deep copying the graph before grouping if you need the original

```typescript
// Safe usage pattern
import { structuredClone } from '@breadboard-ai/utils';

const originalGraph = loadGraph();
const workingGraph = structuredClone(originalGraph);
nodesToSubgraph(workingGraph, nodeGroup, subgraphId);

// originalGraph remains unchanged
// workingGraph contains the subgraph structure
```